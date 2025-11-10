//
//  Dejest_WatchAppApp.swift
//  Dejest-WatchApp Watch App
//
//  Created by idgest on 22/09/2025.
//

import SwiftUI

@main
struct Dejest_WatchAppApp: App {

    init() {
        WatchSessionManager.shared.start()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
