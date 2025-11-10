//
//  WalletBridge.swift
//  Dejest
//
//  Created by idgest on 22/09/2025.
//

import Foundation
import React
import WatchConnectivity
import UIKit

@objc(WalletBridge)
class WalletBridge: RCTEventEmitter, WCSessionDelegate {
  override static func requiresMainQueueSetup() -> Bool { true }
  override func supportedEvents() -> [String]! {
    return ["FetchAccountData"] // RN слушает это событие
  }

  override init() {
    super.init()
    if WCSession.isSupported() {
      let session = WCSession.default
      session.delegate = self
      session.activate()
    }
  }

  // MARK: - Методы для вызова из JS

  @objc func sendToWatch(_ payload: NSDictionary) {
    if WCSession.default.isReachable {
      print("Sending message to watch:", payload)
      WCSession.default.sendMessage(payload as! [String: Any], replyHandler: { response in
        print("Response from watch:", response)
      }, errorHandler: { error in
        print("Error sending message to watch:", error)
      })
    } else {
      print("Watch not reachable")
    }
  }

  @objc func resolveAccountData(_ requestId: String, data: NSDictionary) {
    if WCSession.default.isReachable {
      var payload = data as! [String: Any]
      payload["requestId"] = requestId
      payload["type"] = "account_data_response"
      WCSession.default.sendMessage(payload, replyHandler: nil, errorHandler: nil)
    }
  }

  @objc func pingWatch(_ resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    if WCSession.default.isReachable {
      WCSession.default.sendMessage(["type": "PING"], replyHandler: { response in
        resolve(true)
      }, errorHandler: { error in
        reject("E_PING_FAILED", "Ping failed", error)
      })
    } else {
      resolve(false)
    }
  }

  @objc func generateKeyPair(_ data: NSDictionary,
                             resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
    if WCSession.default.isReachable {
      print("IOS get new request from react native (GENERATE_KEY_PAIR)")
      print("IOS data:", data)
      
      // Prepare the message with data (including optional whitelist)
      var message: [String: Any] = ["type": "GENERATE_KEY_PAIR"]
      
      // Pass through the data dictionary which includes kernelAddress and optional whitelist
      message["data"] = data
      
      WCSession.default.sendMessage(message, replyHandler: { response in
        resolve(response)
      }, errorHandler: { error in
        reject("E_GEN_FAILED", "Key pair generation failed", error)
      })
    } else {
      reject("E_NOT_REACHABLE", "Watch not reachable", nil)
    }
  }

  @objc func syncPermissionData(_ data: NSDictionary,
                                resolver resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
    if WCSession.default.isReachable {
      print("DATA MOBOILE:", data)
      WCSession.default.sendMessage(["type": "SYNC_PERMISSION_DATA", "data": data], replyHandler: { response in
        resolve(true)
      }, errorHandler: { error in
        reject("E_SYNC_FAILED", "Permission sync failed", error)
      })
    } else {
      reject("E_NOT_REACHABLE", "Watch not reachable", nil)
    }
  }

  @objc func getAccountData(_ resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    // Можешь заменить на получение реальных данных из Keychain / WalletManager
    let dummy: [String: Any] = [
      "balance": "0.0",
      "address": "0x0000000000000000000000000000000000000000",
      "history": []
    ]
    resolve(dummy)
  }

  // MARK: - WCSessionDelegate
  func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
    if let type = message["type"] as? String {
      if type == "fetchAccountData" {
        let requestId = message["requestId"] as? String ?? UUID().uuidString
        sendEvent(withName: "FetchAccountData", body: ["requestId": requestId])
      } else if type == "COPY_TO_CLIPBOARD" {
        // Handle clipboard copy request from watch
        if let textToCopy = message["text"] as? String {
          UIPasteboard.general.string = textToCopy
          print("Copied to clipboard: \(textToCopy)")
        }
      }
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {}
}
