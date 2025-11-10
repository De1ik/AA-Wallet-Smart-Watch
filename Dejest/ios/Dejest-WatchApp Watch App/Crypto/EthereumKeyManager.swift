import Foundation
import Web3
import Security

class EthereumKeyManager {
    static let shared = EthereumKeyManager()
    
    private let privateKeyTag = "com.de1ik.wallet.privatekey"
    private let publicKeyTag  = "com.de1ik.wallet.publickey"
    private let publicKernelTag  = "com.de1ik.wallet.kernel"
    private let allowanceCertTag  = "com.de1ik.wallet.allowancecert"
    private let whitelistTag  = "com.de1ik.wallet.whitelist"
    
    private init() {}
    
    /// Generate a new keypair and save both keys
    func generateKey() throws -> EthereumPrivateKey {
        let privateKey = try EthereumPrivateKey()
        let rawPrivate = Data(privateKey.rawPrivateKey)
        print("rawPrivate:", rawPrivate)
        let publicAddress = privateKey.address.hex(eip55: true)
        
        // Save private to Keychain
        saveToKeychain(rawPrivate, tag: privateKeyTag)
        
        // Save public to UserDefaults (safe, not secret)
        UserDefaults.standard.set(publicAddress, forKey: publicKeyTag)
        
        return privateKey
    }
  
    func saveKernelAddress(kernelAddress: String) {
      UserDefaults.standard.set(kernelAddress, forKey: publicKernelTag)
    }
  
    func loadKernelAddress() -> String? {
        return UserDefaults.standard.string(forKey: publicKernelTag)
    }
    
    /// Load private key from Keychain
    func loadPrivateKey() throws -> EthereumPrivateKey? {
        guard let raw = loadFromKeychain(tag: privateKeyTag) else { return nil }
        return try EthereumPrivateKey(raw)
    }
  
//  func loadPrivateKey() throws -> EthereumPrivateKey? {
//      let raw = "eb020020f40c89748cfbcd6f455d3251ee5aa201237553c31bc7353a8b6dadfa"
//      let data = Data(hex: raw)
//      return try EthereumPrivateKey(data)
//  }
    
    /// Load public key (address) from UserDefaults
    func loadPublicKey() -> String? {
        return UserDefaults.standard.string(forKey: publicKeyTag)
    }
  
    func saveAllowance(allowance: String) {
        UserDefaults.standard.set(allowance, forKey: allowanceCertTag)
    }
  
  func loadAllowance() -> String? {
    return UserDefaults.standard.string(forKey: allowanceCertTag)
  }
  
  /// Save whitelist of receivers
  func saveWhitelist(whitelist: [[String: Any]]) {
    // Convert whitelist to JSON data
    if let jsonData = try? JSONSerialization.data(withJSONObject: whitelist, options: []) {
      UserDefaults.standard.set(jsonData, forKey: whitelistTag)
      print("Whitelist saved to UserDefaults")
    } else {
      print("Failed to serialize whitelist")
    }
  }
  
  /// Load whitelist of receivers
  func loadWhitelist() -> [[String: Any]]? {
    guard let jsonData = UserDefaults.standard.data(forKey: whitelistTag) else {
      print("No whitelist data found")
      return nil
    }
    
    if let whitelist = try? JSONSerialization.jsonObject(with: jsonData, options: []) as? [[String: Any]] {
      return whitelist
    } else {
      print("Failed to deserialize whitelist")
      return nil
    }
  }
    
    // MARK: - Keychain helpers
    private func saveToKeychain(_ data: Data, tag: String) {
        let query: [String: Any] = [
            kSecClass as String       : kSecClassGenericPassword,
            kSecAttrAccount as String : tag,
            kSecValueData as String   : data,
            kSecAttrAccessible as String : kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        SecItemDelete(query as CFDictionary) // remove old
        SecItemAdd(query as CFDictionary, nil)
    }
    
    private func loadFromKeychain(tag: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String       : kSecClassGenericPassword,
            kSecAttrAccount as String : tag,
            kSecReturnData as String  : kCFBooleanTrue!,
            kSecMatchLimit as String  : kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess else { return nil }
        return result as? Data
    }
}
