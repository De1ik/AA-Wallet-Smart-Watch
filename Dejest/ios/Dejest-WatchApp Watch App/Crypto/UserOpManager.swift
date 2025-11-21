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
    
    func amountToUnits(_ amount: Double, decimals: Int) -> String {
        let factor = pow(10.0, Double(decimals))
        let units = amount * factor
        return String(format: "%.0f", units)
    }
  
    // MARK: - Step 1: Отправляем на сервер данные (from, to, amount)
    func requestUnsignedUserOp(kernelAddress: String, from: String, to: String, amountInWei: String, tokenAddress: String?, completion: @escaping (Result<PrepareUserOpResponse, Error>) -> Void) {
        let url = URL(string: "\(backendURL)/userOp/prepare")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        

        var body: [String: Any] = [
            "delegatedEOA": from,
            "to": to,
            "amountWei": amountInWei,
            "data": "0x",
            "kernelAddress": kernelAddress
        ]
        if let token = tokenAddress, !token.isEmpty {
            body["tokenAddress"] = token
        }
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        print("📤 Sending request to backend:", url)
        print("📤 Body:", body)
        
        URLSession.shared.dataTask(with: req) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            let responseData = data
            
            if let httpResponse = response as? HTTPURLResponse,
               !(200..<300).contains(httpResponse.statusCode) {
                completion(.failure(self.makeBackendError(from: responseData,
                                                          fallback: "Failed to prepare transaction.",
                                                          statusCode: httpResponse.statusCode)))
                return
            }
            
            guard let data = responseData else {
                completion(.failure(self.makeBackendError(from: nil,
                                                          fallback: "Empty response from backend.")))
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
                completion(.failure(self.makeBackendError(from: data,
                                                          fallback: error.localizedDescription)))
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
    func sendSignedUserOp(kernelAddress: String, from: String, to: String, amountInWei: String, tokenAddress: String?, userOpHash: String, signature: String, completion: @escaping (Result<String, Error>) -> Void) {
        let url = URL(string: "\(backendURL)/userOp/broadcast")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "delegatedEOA": from,
            "to": to,
            "amountWei": amountInWei,
            "data": "0x",
            "signature": signature,
            "opHash": userOpHash,
            "kernelAddress": kernelAddress
        ]
        if let token = tokenAddress, !token.isEmpty {
            body["tokenAddress"] = token
        }
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        print("📤 Sending signed UserOp back to backend:", body)
        
        URLSession.shared.dataTask(with: req) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            let responseData = data
            
            if let httpResponse = response as? HTTPURLResponse,
               !(200..<300).contains(httpResponse.statusCode) {
                completion(.failure(self.makeBackendError(from: responseData,
                                                          fallback: "Failed to broadcast transaction.",
                                                          statusCode: httpResponse.statusCode)))
                return
            }
            
            guard let data = responseData else {
                completion(.failure(self.makeBackendError(from: nil,
                                                          fallback: "Empty response from backend.")))
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
                    completion(.failure(self.makeBackendError(from: data,
                                                              fallback: "Invalid backend response.")))
                }
            } catch {
                completion(.failure(self.makeBackendError(from: data,
                                                          fallback: error.localizedDescription)))
            }
        }.resume()
    }
    
    // MARK: - Full workflow
  func prepareSignAndSendUserOp(kernelAddress: String, from: String, to: String, amountInWei: String, tokenAddress: String?, completion: @escaping (Result<String, Error>) -> Void) {
    requestUnsignedUserOp(kernelAddress: kernelAddress, from: from, to: to, amountInWei: amountInWei, tokenAddress: tokenAddress) { result in
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
                          tokenAddress: tokenAddress,
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
    
    // MARK: - Error handling helpers
    private struct BackendError: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }
    
    private func makeBackendError(from data: Data?, fallback: String, statusCode: Int? = nil) -> Error {
        if let data = data,
           let message = extractMessage(from: data) {
            return BackendError(message: message)
        }
        
        if let statusCode = statusCode {
            return BackendError(message: interpretMessage("\(fallback) (\(statusCode))"))
        }
        
        return BackendError(message: interpretMessage(fallback))
    }
    
    private func extractMessage(from data: Data) -> String? {
        guard !data.isEmpty else { return nil }
        
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let nestedError = json["error"] as? [String: Any],
               let nestedMessage = firstMessage(in: nestedError) {
                return interpretMessage(nestedMessage)
            }
            
            if let message = firstMessage(in: json) {
                return interpretMessage(message)
            }
            
            if let dataField = json["data"] as? String,
               let friendly = selectorFriendlyMessage(in: dataField) {
                return friendly
            }
        }
        
        if let text = String(data: data, encoding: .utf8),
           !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return interpretMessage(text)
        }
        
        return nil
    }
    
    private func firstMessage(in dictionary: [String: Any]) -> String? {
        let keys = ["message", "error", "reason", "details", "data"]
        for key in keys {
            if let value = dictionary[key] as? String,
               !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                if key == "data", let friendly = selectorFriendlyMessage(in: value) {
                    return friendly
                }
                return value
            }
            
            if let nested = dictionary[key] as? [String: Any],
               let nestedMessage = firstMessage(in: nested) {
                return nestedMessage
            }
            
            if let array = dictionary[key] as? [String],
               let first = array.first,
               !first.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return first
            }
        }
        return nil
    }
    
    private func interpretMessage(_ text: String) -> String {
        if let friendly = selectorFriendlyMessage(in: text) {
            return friendly
        }
        return text
    }
    
    private func selectorFriendlyMessage(in text: String) -> String? {
        let lower = text.lowercased()
        if lower.contains("0xb32eeb69") {
            return "Permission is not granted for this account. Approve spending in the mobile app."
        }
        if lower.contains("0x27bf05de") {
            return "Spending limit for this token has been exceeded."
        }
        if lower.contains("0x7b5812d4") {
            return "Defined policy rules were violated for this transaction."
        }
        return nil
    }
}
