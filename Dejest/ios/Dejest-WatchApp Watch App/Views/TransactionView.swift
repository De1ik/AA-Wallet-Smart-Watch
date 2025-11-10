import SwiftUI
import Web3

struct TransactionView: View {
    @State private var toAddress: String = ""
    @State private var amount: String = "0.0001"
    @State private var txHash: String = ""
    @State private var errorText: String = ""
    
    @State private var privateKeyHex: String = ""
    @State private var publicAddress: String = ""
    
    @State private var showNumberPad: Bool = false   // controls pad visibility
    @State private var isLoading: Bool = false
    
    // Whitelist data
    @State private var whitelist: [[String: Any]] = []
    @State private var selectedReceiverIndex: Int = 0
    @State private var showReceiverPicker: Bool = false
    
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
            
            ScrollView {
                VStack {
                        // VStack(alignment: .leading, spacing: 8) {
                        //     Text("Private Key:")
                        //         .font(.caption).bold()
                        //     Text(privateKeyHex)
                        //         .font(.system(size: 10))
                        //         .foregroundColor(.gray)
                        //         .lineLimit(nil)
                            
                        //     Text("Public Address:")
                        //         .font(.caption).bold()
                        //     Text(publicAddress)
                        //         .font(.system(size: 12))
                        //         .foregroundColor(.blue)
                        //         .lineLimit(1)
                        //         .truncationMode(.middle)
                        // }
                        // .padding(.top, 10)
                        
                        Text("Send Transaction")
                            .font(.headline)
                            .padding(.bottom, 8)
                    
                    // Receiver Selection
                    if !whitelist.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("To:")
                                .font(.caption)
                                .foregroundColor(.gray)
                            
                            Button(action: {
                                showReceiverPicker = true
                            }) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(getReceiverName(index: selectedReceiverIndex))
                                            .font(.body)
                                            .foregroundColor(.white)
                                        Text(getReceiverAddress(index: selectedReceiverIndex))
                                            .font(.caption2)
                                            .foregroundColor(.gray)
                                            .lineLimit(1)
                                            .truncationMode(.middle)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.down")
                                        .font(.caption)
                                        .foregroundColor(.gray)
                                }
                                .padding(8)
                                .background(Color.gray.opacity(0.2))
                                .cornerRadius(10)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.bottom, 10)
                    } else {
                        // Fallback to manual entry if no whitelist
                        TextField("Recipient address", text: $toAddress)
                            .textInputAutocapitalization(.never)
                            .disableAutocorrection(true)
                            .padding(.bottom, 10)
                    }
                    
                    // Modern Amount Entry
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Amount:")
                            .font(.caption)
                            .foregroundColor(.gray)
                        
                        Button(action: {
                            showNumberPad = !showNumberPad
                        }) {
                            HStack {
                                Text(amount.isEmpty ? "Tap to enter" : amount)
                                    .font(.system(size: 16, weight: .medium))
                                    .foregroundColor(amount.isEmpty ? .gray.opacity(0.6) : .white)
                                Spacer()
                                Image(systemName: "pencil")
                                    .font(.caption)
                                    .foregroundColor(.gray.opacity(0.5))
                            }
                            .padding(12)
                            .background(Color.gray.opacity(0.2))
                            .cornerRadius(10)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.bottom, 10)
                    
                    if showNumberPad {
                        numberPad
                    }
              
                    if isLoading {
                         ProgressView("Processing transaction...")
                             .padding(.top, 10)
                    } else {
                        Button(action: {
                            sendDelegatedTransaction()
                        }) {
                            Text("Send")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 40)
                                .background(
                                    LinearGradient(
                                        colors: [Color(hex: "10B981").opacity(0.9), Color(hex: "10B981").opacity(0.7)],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                )
                                .cornerRadius(10)
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 10)
                        .disabled(toAddress.isEmpty || amount.isEmpty)

                    }
                    
                    if !txHash.isEmpty {
                        Text("Transaction hash:")
                            .font(.caption).bold()
                        Text(txHash)
                            .font(.system(size: 12))
                            .foregroundColor(.blue)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                    
                    if !errorText.isEmpty {
                        Text(errorText)
                            .font(.system(size: 12))
                            .foregroundColor(.red)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                }
                .padding()
            }
        }
        .onAppear {
            loadKeys()
        }
        .sheet(isPresented: $showReceiverPicker) {
            ReceiverPickerView(
                whitelist: whitelist,
                selectedIndex: $selectedReceiverIndex,
                isPresented: $showReceiverPicker
            ) { index in
                updateSelectedReceiver(index: index)
                showReceiverPicker = false
            }
        }
    }
    
    // MARK: - Key Management
    
    private func loadKeys() {
        do {
            let privKey = try EthereumKeyManager.shared.loadPrivateKey()
            if let privKey = privKey {
                privateKeyHex = privKey.rawPrivateKey.toHexString()
                publicAddress = EthereumKeyManager.shared.loadPublicKey() ?? privKey.address.hex(eip55: true)
            }
        } catch {
            errorText = "Error: \(error.localizedDescription)"
        }
        
        // Load whitelist
        loadWhitelist()
    }
    
    private func loadWhitelist() {
        if let savedWhitelist = EthereumKeyManager.shared.loadWhitelist() {
            whitelist = savedWhitelist
            print("Loaded whitelist with \(whitelist.count) items")
            
            // If there are receivers in the whitelist, pre-select the first one
            if !whitelist.isEmpty {
                updateSelectedReceiver(index: 0)
            }
        } else {
            print("No whitelist found")
        }
    }
    
    private func updateSelectedReceiver(index: Int) {
        guard index >= 0 && index < whitelist.count else { return }
        
        if let address = whitelist[index]["address"] as? String {
            toAddress = address
            selectedReceiverIndex = index
        }
    }
    
    private func getReceiverName(index: Int) -> String {
        guard index >= 0 && index < whitelist.count else { return "" }
        return whitelist[index]["name"] as? String ?? "Unknown"
    }
    
    private func getReceiverAddress(index: Int) -> String {
        guard index >= 0 && index < whitelist.count else { return "" }
        return whitelist[index]["address"] as? String ?? ""
    }
    
    // MARK: - Delegated Transaction Flow
    
    private func sendDelegatedTransaction() {
        guard let amountDouble = Double(amount) else {
            errorText = "Invalid amount"
            return
        }
      
        isLoading = true
        
        let from = publicAddress
        let to = toAddress
        let amountInWei = UserOpManager.shared.ethToWei(amountDouble)
      
        guard let kernelAddress = EthereumKeyManager.shared.loadKernelAddress() else {
          errorText = "Kernel Account is empty"
          return
        }
        
        print("🚀 Starting delegated tx: from=\(from), to=\(to), amount=\(amountDouble)")
        
        UserOpManager.shared.prepareSignAndSendUserOp(kernelAddress: kernelAddress, from: from, to: to, amountInWei: amountInWei) { result in
          DispatchQueue.main.async {
            isLoading = false
            
            switch result {
                case .success(let hash):
                    print("✅ Delegated transaction sent! Hash: \(hash)")
                    WatchSessionManager.shared.handleTxSuccess(hash: hash)

                case .failure(let error):
                    print("❌ Delegated transaction error:", error.localizedDescription)
                    errorText = "❌ " + error.localizedDescription
              }
          }
        }
    }
    
    // MARK: - Number pad
    
    private var numberPad: some View {
        VStack(spacing: 5) {
            // Number buttons - Compact 3x3 grid
            HStack(spacing: 5) {
                numButton("1"); numButton("2"); numButton("3")
            }
            HStack(spacing: 5) {
                numButton("4"); numButton("5"); numButton("6")
            }
            HStack(spacing: 5) {
                numButton("7"); numButton("8"); numButton("9")
            }
            
            // Bottom row - Decimal, Zero, Delete
            HStack(spacing: 5) {
                numButton("."); 
                numButton("0")
                Button(action: {
                    if !amount.isEmpty { amount.removeLast() }
                }) {
                    Image(systemName: "delete.backward")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .background(
                            LinearGradient(
                                colors: [Color(hex: "EF4444").opacity(0.9), Color(hex: "EF4444").opacity(0.7)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .cornerRadius(10)
                }
                .buttonStyle(.plain)
            }
            
            // Done button - Compact
            // Button(action: {
            //     showNumberPad = false
            // }) {
            //     Text("Done")
            //         .font(.system(size: 14, weight: .semibold))
            //         .foregroundColor(.white)
            //         .frame(maxWidth: .infinity)
            //         .frame(height: 36)
            //         .background(
            //             LinearGradient(
            //                 colors: [Color(hex: "10B981").opacity(0.9), Color(hex: "10B981").opacity(0.7)],
            //                 startPoint: .top,
            //                 endPoint: .bottom
            //             )
            //         )
            //         .cornerRadius(10)
            // }
            // .padding(.top, 2)
            // .buttonStyle(.plain)
        }
        .padding(.bottom, 8)
    }
    
    private func numButton(_ char: String) -> some View {
        Button(action: {
            if char == "." && amount.contains(".") { return }
            amount.append(char)
        }) {
            Text(char)
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 36)
                        .background(
                            LinearGradient(
                                colors: [Color(hex: "8B5CF6").opacity(0.7), Color(hex: "8B5CF6").opacity(0.5)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                .cornerRadius(10)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Color Extension (File Scope)

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Receiver Picker View

struct ReceiverPickerView: View {
    let whitelist: [[String: Any]]
    @Binding var selectedIndex: Int
    @Binding var isPresented: Bool
    let onSelect: (Int) -> Void
    
    var body: some View {
        NavigationView {
            List {
                ForEach(0..<whitelist.count, id: \.self) { index in
                    Button(action: {
                        onSelect(index)
                        selectedIndex = index
                    }) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(whitelist[index]["name"] as? String ?? "Unknown")
                                    .font(.body)
                                    .foregroundColor(.primary)
                                
                                Text(whitelist[index]["address"] as? String ?? "")
                                    .font(.caption2)
                                    .foregroundColor(.gray)
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                            }
                            
                            Spacer()
                            
                            if index == selectedIndex {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.blue)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("Select Receiver")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }
            }
        }
    }
}
