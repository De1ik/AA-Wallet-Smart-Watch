import Foundation

/// Mirrors the mobile app's balance/token response payload.
struct TokenBalanceDTO: Codable {
    let symbol: String
    let name: String
    let balance: String?
    let value: Double?
    let decimals: Int?
    let address: String?
    let color: String?
    let amount: String?
}

struct BalancesResponseDTO: Codable {
    let success: Bool
    let ethBalance: String
    let tokens: [TokenBalanceDTO]
    let message: String?
}

/// Mirrors the transaction history payload that the React Native app consumes
struct TransactionDTO: Codable, Identifiable {
    let hash: String
    let from: String?
    let to: String?
    let value: String
    let timestamp: TimeInterval
    let type: String?
    let status: String?
    let tokenSymbol: String?
    let tokenAddress: String?
    let eventType: String?
    let errorMessage: String?
    let tokenId: String?
    
    var id: String { hash + (tokenId ?? "") + (eventType ?? "") }
}

struct TransactionsResponseDTO: Codable {
    let success: Bool
    let transactions: [TransactionDTO]
    let message: String?
    let limit: Int?
}

struct AccountStateSnapshot {
    let address: String
    let ethBalance: String
    let tokens: [TokenBalanceDTO]
    let history: [TransactionDTO]
}

enum AccountStateServiceError: LocalizedError {
    case addressMissing
    case invalidURL
    case emptyResponse
    case backend(message: String)
    case unknown
    
    var errorDescription: String? {
        switch self {
        case .addressMissing:
            return "Wallet address is not available."
        case .invalidURL:
            return "Failed to build backend URL."
        case .emptyResponse:
            return "Backend returned an empty response."
        case .backend(let message):
            return message
        case .unknown:
            return "Unknown account state error."
        }
    }
}

/// Simple HTTP client that reuses the mobile app's wallet endpoints for watchOS.
final class AccountStateService {
    static let shared = AccountStateService()
    
    private let walletBaseURL: URL
    private let session: URLSession
    
    private init(session: URLSession = .shared) {
        // Expo app default -> http://localhost:4000
        let baseURL = URL(string: "http://localhost:4000")!
        self.walletBaseURL = baseURL.appendingPathComponent("wallet")
        self.session = session
    }
    
    func fetchAccountState(
        for address: String,
        limit: Int = 20,
        completion: @escaping (Result<AccountStateSnapshot, Error>) -> Void
    ) {
        guard !address.isEmpty else {
            completion(.failure(AccountStateServiceError.addressMissing))
            return
        }
        
        let dispatchGroup = DispatchGroup()
        var balanceResponse: BalancesResponseDTO?
        var historyResponse: TransactionsResponseDTO?
        var balanceError: Error?
        var historyError: Error?
        
        dispatchGroup.enter()
        fetchBalances(for: address) { result in
            switch result {
            case .success(let response):
                balanceResponse = response
            case .failure(let error):
                balanceError = error
            }
            dispatchGroup.leave()
        }
        
        dispatchGroup.enter()
        fetchTransactions(for: address, limit: limit) { result in
            switch result {
            case .success(let response):
                historyResponse = response
            case .failure(let error):
                historyError = error
            }
            dispatchGroup.leave()
        }
        
        dispatchGroup.notify(queue: .main) {
            if let balanceError = balanceError {
                completion(.failure(balanceError))
                return
            }
            
            if let historyError = historyError {
                completion(.failure(historyError))
                return
            }
            
            guard
                let balances = balanceResponse,
                balances.success
            else {
                let message = balanceResponse?.message ?? "Failed to load balance."
                completion(.failure(AccountStateServiceError.backend(message: message)))
                return
            }
            
            guard
                let history = historyResponse,
                history.success
            else {
                let message = historyResponse?.message ?? "Failed to load history."
                completion(.failure(AccountStateServiceError.backend(message: message)))
                return
            }
            
            let snapshot = AccountStateSnapshot(
                address: address,
                ethBalance: balances.ethBalance,
                tokens: balances.tokens,
                history: history.transactions
            )
            completion(.success(snapshot))
        }
    }
    
    
    private func fetchBalances(
        for address: String,
        completion: @escaping (Result<BalancesResponseDTO, Error>) -> Void
    ) {
        guard var components = URLComponents(url: walletBaseURL.appendingPathComponent("balances"), resolvingAgainstBaseURL: false) else {
            completion(.failure(AccountStateServiceError.invalidURL))
            return
        }
        components.queryItems = [URLQueryItem(name: "address", value: address)]
        guard let url = components.url else {
            completion(.failure(AccountStateServiceError.invalidURL))
            return
        }
        
        performRequest(url: url, completion: completion)
    }
    
    private func fetchTransactions(
        for address: String,
        limit: Int,
        completion: @escaping (Result<TransactionsResponseDTO, Error>) -> Void
    ) {
        guard var components = URLComponents(url: walletBaseURL.appendingPathComponent("transactions"), resolvingAgainstBaseURL: false) else {
            completion(.failure(AccountStateServiceError.invalidURL))
            return
        }
        components.queryItems = [
            URLQueryItem(name: "address", value: address),
            URLQueryItem(name: "limit", value: String(limit))
        ]
        guard let url = components.url else {
            completion(.failure(AccountStateServiceError.invalidURL))
            return
        }
        
        performRequest(url: url, completion: completion)
    }
    
    private func performRequest<T: Decodable>(
        url: URL,
        completion: @escaping (Result<T, Error>) -> Void
    ) {
        let task = session.dataTask(with: url) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            let responseData = data
            
            if let httpResponse = response as? HTTPURLResponse,
               !(200..<300).contains(httpResponse.statusCode) {
                let message = self.extractBackendMessage(from: responseData) ?? "Backend responded with an error."
                completion(.failure(AccountStateServiceError.backend(message: message)))
                return
            }
            
            guard let data = responseData, !data.isEmpty else {
                completion(.failure(AccountStateServiceError.emptyResponse))
                return
            }
            
            do {
                let decoder = JSONDecoder()
                let decoded = try decoder.decode(T.self, from: data)
                completion(.success(decoded))
            } catch {
                let message = self.extractBackendMessage(from: data) ?? error.localizedDescription
                completion(.failure(AccountStateServiceError.backend(message: message)))
            }
        }
        task.resume()
    }
    
    private func extractBackendMessage(from data: Data?) -> String? {
        guard let data = data, !data.isEmpty else { return nil }
        
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let message = firstMessage(in: json) {
                return message
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
                return interpretMessage(value)
            }
            
            if let nested = dictionary[key] as? [String: Any],
               let nestedMessage = firstMessage(in: nested) {
                return nestedMessage
            }
            
            if let array = dictionary[key] as? [String],
               let first = array.first,
               !first.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return interpretMessage(first)
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
