//
//  DelegatedAddressView.swift
//  Dejest
//
//  Created by idgest on 22/09/2025.
//

import SwiftUI

struct DelegatedAddressView: View {
    private let publicAddress: String

    init() {
        if let savedAddress = EthereumKeyManager.shared.loadPublicKey() {
            self.publicAddress = savedAddress
        } else if let privateKey = try? EthereumKeyManager.shared.loadPrivateKey() {
            self.publicAddress = privateKey.address.hex(eip55: true)
        } else {
            self.publicAddress = "Unknown"
        }
    }

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [
                    Color(hex: "8B5CF6").opacity(0.3),
                    Color(hex: "8B5CF6").opacity(0.15),
                    Color.black.opacity(1.0)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack {
            Text("Delegated Public Address")
                .font(.headline)

            Text(publicAddress)
                .font(.system(.body, design: .monospaced))
                .lineLimit(1)
                .truncationMode(.middle)
                .padding()
            }
        }
    }
}
