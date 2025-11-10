import SwiftUI

struct ContentView: View {
  @ObservedObject var session = WatchSessionManager.shared
  
  var body: some View {
    Group {
      if session.showSuccessView {
        SuccessView()
      } else if session.showInstallationWaiting {
        InstallationWaitingView()
      } else if session.showKeyGenerated {
        KeyGeneratedView()
      } else {
        switch session.currentScreen {
        case .home:
            TabView {
                DelegatedAddressView()
                    .tabItem { Label("Home", systemImage: "house") }
                
                TransactionView()
                    .tabItem { Label("Transactions", systemImage: "arrow.up.arrow.down") }
                
            }
        case .transactions:
            TransactionView()
        }
      }
    }
  }
}


//struct ContentView: View {
//    @ObservedObject var session = WatchSessionManager.shared
//
//    var body: some View {
//        if session.showKeyGenerated {
//            // Экран с адресом после генерации
//            KeyGeneratedView()
//        } else if session.showSuccessView {
//          SuccessView()
//        } else {
//            // Твой основной TabView
//            TabView {
//                //WalletHomeView()
//                DelegatedAddressView()
//                TransactionView()
////                BalanceView()
//            }
//            .tabViewStyle(.page)
//        }
//    }
//}


//#Preview {
//    ContentView()
//}

