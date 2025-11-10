import Foundation
import Web3

struct PrepareUserOpResponse: Codable {
    let userOpHash: String
}

class UserOpManager {
    static let shared = UserOpManager()
    private init() {}
    
    let backendURL = "http://localhost:4000/wallet" // твой бекенд
  
    func ethToWei(_ eth: Double) -> String {
        let wei = eth * pow(10.0, 18.0)
        return String(format: "%.0f", wei)
    }
  
    // MARK: - Step 1: Отправляем на сервер данные (from, to, amount)
    func requestUnsignedUserOp(kernelAddress: String, from: String, to: String, amountInWei: String, completion: @escaping (Result<PrepareUserOpResponse, Error>) -> Void) {
        let url = URL(string: "\(backendURL)/userOp/prepare")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        

        let body: [String: Any] = [
            "delegatedEOA": from,
            "to": to,
            "amountWei": amountInWei,
            "data": "0x",
            "kernelAddress": kernelAddress
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        print("📤 Sending request to backend:", url)
        print("📤 Body:", body)
        
        URLSession.shared.dataTask(with: req) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "Wallet", code: -1,
                                            userInfo: [NSLocalizedDescriptionKey: "Empty response"])))
                return
            }
            
            if let rawString = String(data: data, encoding: .utf8) {
                print("📥 Raw server response:", rawString)
            }
            
            do {
                let decoder = JSONDecoder()
                let response = try decoder.decode(PrepareUserOpResponse.self, from: data)
                completion(.success(response))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    // MARK: - Step 2: Подписываем userOpHash (оставляем твой метод как есть)
    func signUserOpHash(userOpHash: String, completion: @escaping (Result<String, Error>) -> Void) {
        do {
            guard let privateKey = try EthereumKeyManager.shared.loadPrivateKey() else {
                completion(.failure(NSError(domain: "UserOp", code: -2,
                                            userInfo: [NSLocalizedDescriptionKey: "No key in Keychain"])))
                return
            }
            
            let hashData = Data(hex: userOpHash)
            let signature = try privateKey.sign(hash: [UInt8](hashData))
            
            // Pad r and s
            let rPadded = signature.r.count == 32 ? signature.r : Array(repeating: 0, count: 32 - signature.r.count) + signature.r
            let sPadded = signature.s.count == 32 ? signature.s : Array(repeating: 0, count: 32 - signature.s.count) + signature.s
            
            var fullSignature = Data(rPadded)
            fullSignature.append(Data(sPadded))
            fullSignature.append(UInt8(signature.v < 27 ? signature.v + 27 : signature.v))
            
            let signatureHex = "0x" + fullSignature.map { String(format: "%02x", $0) }.joined()
            completion(.success(signatureHex))
        } catch {
            completion(.failure(error))
        }
    }
    
    // MARK: - Step 3: Отправляем подписанный userOpHash на сервер
    func sendSignedUserOp(kernelAddress: String, from: String, to: String, amountInWei: String, userOpHash: String, signature: String, completion: @escaping (Result<String, Error>) -> Void) {
        let url = URL(string: "\(backendURL)/userOp/broadcast")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "delegatedEOA": from,
            "to": to,
            "amountWei": amountInWei,
            "data": "0x",
            "signature": signature,
            "opHash": userOpHash,
            "kernelAddress": kernelAddress
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        print("📤 Sending signed UserOp back to backend:", body)
        
        URLSession.shared.dataTask(with: req) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "UserOp", code: -3,
                                            userInfo: [NSLocalizedDescriptionKey: "Empty response"])))
                return
            }
            
            if let raw = String(data: data, encoding: .utf8) {
                print("📥 Raw backend response:", raw)
            }
            
            do {
                let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                if let txHash = json?["txHash"] as? String {
                    completion(.success(txHash))
                } else {
                    completion(.failure(NSError(domain: "UserOp", code: -4,
                                                userInfo: [NSLocalizedDescriptionKey: "Invalid backend response"])))
                }
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    // MARK: - Full workflow
  func prepareSignAndSendUserOp(kernelAddress: String, from: String, to: String, amountInWei: String, completion: @escaping (Result<String, Error>) -> Void) {
    requestUnsignedUserOp(kernelAddress: kernelAddress, from: from, to: to, amountInWei: amountInWei) { result in
            switch result {
            case .success(let unsignedResponse):
                self.signUserOpHash(userOpHash: unsignedResponse.userOpHash) { signResult in
                    switch signResult {
                    case .success(let signatureHex):
                        self.sendSignedUserOp(
                          kernelAddress: kernelAddress,
                          from: from,
                          to: to,
                          amountInWei: amountInWei,
                          userOpHash: unsignedResponse.userOpHash,
                          signature: signatureHex,
                          completion: completion
                        )
                    case .failure(let error):
                        completion(.failure(error))
                    }
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }
}
