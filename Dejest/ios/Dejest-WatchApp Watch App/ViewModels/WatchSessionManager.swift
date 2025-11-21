import Foundation
import WatchConnectivity

enum AppScreen {
    case home
    case transactions
}

class WatchSessionManager: NSObject, WCSessionDelegate, ObservableObject {
    static let shared = WatchSessionManager()
  
  @Published var currentScreen: AppScreen = .home
  
    @Published var generatedAddress: String = "-"
    @Published var showKeyGenerated: Bool = false
    
    @Published var showInstallationWaiting: Bool = false
    
    @Published var txHash: String? = nil
    @Published var showSuccessView: Bool = false
  
  
    private override init() { super.init() }
  
  
    func closeKeyGeneratedView() {
            DispatchQueue.main.async {
                self.showKeyGenerated = false
                self.generatedAddress = ""
        }
    }
    
    func showInstallationWaitingView() {
        DispatchQueue.main.async {
            self.showInstallationWaiting = true
        }
    }
    
    func closeInstallationWaitingView() {
        DispatchQueue.main.async {
            self.showInstallationWaiting = false
            self.showKeyGenerated = false
            self.generatedAddress = ""
        }
    }
  
    func handleTxSuccess(hash: String) {
          DispatchQueue.main.async {
              self.txHash = hash
              self.showSuccessView = true
          }
    }
      
  func closeSuccessView(redirectTo: AppScreen = .home) {
        DispatchQueue.main.async {
            self.showSuccessView = false
            self.txHash = nil
            self.currentScreen = redirectTo
        }
    }
  
  
    // MARK: - Start WCSession
    func start() {
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }

    // MARK: - Получение сообщений от iPhone
    func session(_ session: WCSession, didReceiveMessage message: [String : Any],
                 replyHandler: @escaping ([String : Any]) -> Void) {
        print("⌚️ Received message from iPhone:", message)

        guard let type = message["type"] as? String else {
            replyHandler(["success": false, "error": "Unknown message type"])
            return
        }

        switch type {
        case "PING":
            replyHandler([
                "type": "PONG",
                "success": true,
                "timestamp": Date().timeIntervalSince1970
            ])

        case "GENERATE_KEY_PAIR":
  
          print("Smart Watch Generating Keys...")
          
          do {
            
            if let data = message["data"] as? [String: Any] {
              // Save kernel address if provided
              if let kernelAddress = data["kernelAddress"] as? String {
                EthereumKeyManager.shared.saveKernelAddress(kernelAddress: kernelAddress)
                print("Saved kernel address: \(kernelAddress)")
              }
              
              // Process whitelist if provided
              if let whitelist = data["whitelist"] as? [[String: Any]] {
                print("Received whitelist with \(whitelist.count) items")
                
                // Store whitelist in UserDefaults
                EthereumKeyManager.shared.saveWhitelist(whitelist: whitelist)
                
                // Print whitelist details for debugging
                for (index, recipient) in whitelist.enumerated() {
                  if let name = recipient["name"] as? String,
                     let address = recipient["address"] as? String {
                    print("Whitelist item \(index + 1): \(name) - \(address)")
                  }
                }
              } else {
                print("No whitelist provided in key generation request")
              }
            }
            
            let privateKey = try EthereumKeyManager.shared.generateKey()
            let publicAddress = privateKey.address.hex(eip55: true)
            
            print("Private Key:", privateKey)
            print("publicAddress:", publicAddress)
            
            
            let keyPair = [
              "address":   publicAddress
            ]
            replyHandler([
              "type": "KEY_PAIR_GENERATED",
              "success": true,
              "data": keyPair
            ])
            
            DispatchQueue.main.async {
              self.generatedAddress = publicAddress
              self.showKeyGenerated = true
            }
          } catch {
            print("Error during key generation: \(error)")
                  replyHandler([
                      "type": "KEY_PAIR_GENERATED",
                      "success": false,
                      "error": "Key generation failed"
                  ])
          }

        case "START_INSTALLATION":
            print("Starting installation process...")
            DispatchQueue.main.async {
                self.showInstallationWaiting = true
            }
            replyHandler([
                "type": "INSTALLATION_STARTED",
                "success": true
            ])

        case "SYNC_PERMISSION_DATA":
            print("SYNC_PERMISSION_DATA...")
            if let data = message["data"] as? [String: Any] {
                print("Permission data synced:", data)
                // Persist allowed tokens for transaction picker
                if let tokens = data["allowedTokens"] as? [[String: Any]] {
                    EthereumKeyManager.shared.saveAllowedTokens(tokens: tokens)
                    print("Saved \(tokens.count) allowed tokens")
                }
            }
            replyHandler([
                "type": "PERMISSION_DATA_SYNCED",
                "success": true
            ])

        case "account_data_response":
            print("Updated account data:", message)
            // здесь можно обновлять UI или ViewModel

        default:
            replyHandler(["success": false, "error": "Unhandled message type: \(type)"])
        }
    }

    // MARK: - WCSessionDelegate обязательные методы
    func session(_ session: WCSession,
                 activationDidCompleteWith activationState: WCSessionActivationState,
                 error: Error?) {
        print("⌚️ WCSession activated with state:", activationState.rawValue,
              "error:", error?.localizedDescription ?? "none")
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        print("⌚️ Reachability changed:", session.isReachable)
    }
}
