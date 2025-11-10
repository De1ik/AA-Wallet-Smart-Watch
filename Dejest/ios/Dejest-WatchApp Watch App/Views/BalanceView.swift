//
//  BalanceView.swift
//  solanawallet
//
//  Created by idgest on 31/08/2025.
//

import SwiftUI
import UIKit

struct BalanceView: View {
    @State private var balance: String = "Loading..."
    @State private var errorMessage: String?
    
    // For now we hardcode; later you can pass in your actual wallet address
    let address: String = EthereumKeyManager.shared.loadPublicKey() ?? ""
    
    var body: some View {
        VStack(spacing: 12) {
            Text("Address:")
              .font(.caption).bold()
            Text(address)
              .font(.system(size: 12))
              .foregroundColor(.blue)
              .lineLimit(1)
              .truncationMode(.middle)

            Text("Account Balance")
                .font(.headline)
            
            if let errorMessage = errorMessage {
                Text("❌ \(errorMessage)")
                    .foregroundColor(.red)
                    .font(.caption)
            } else {
                Text("\(balance) ETH")
                    .font(.title2)
                    .bold()
            }
        }
        .padding()
        .onAppear {
            loadBalance()
        }
    }
    
    private func loadBalance() {
//        EthereumTransactionManager.shared.fetchBalance(address: address) { result in
//            DispatchQueue.main.async {
//                switch result {
//                case .success(let bal):
//                    self.balance = bal
//                case .failure(let error):
//                    self.errorMessage = error.localizedDescription
//                }
//            }
//        }
    }
}
