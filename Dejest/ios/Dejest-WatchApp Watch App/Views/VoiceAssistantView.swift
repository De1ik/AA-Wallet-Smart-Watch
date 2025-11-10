// Views/VoiceAssistantView.swift

import SwiftUI

//struct VoiceAssistantView: View {
//    @StateObject var recorder = AudioRecorder()
//    @State private var isUploading = false
//    @State private var uploadResult: String?
//    
//    let userId = "user_id"
//    let sessionId = UUID().uuidString // Генерируй как надо
//    
//    var body: some View {
//        VStack {
//            Text("Voice Assistant")
//                .font(.headline)
//                .padding(.bottom, 12)
//            
//            if recorder.isRecording {
//                Button("Stop & Send") {
//                    recorder.stopRecording()
//                    if let url = recorder.audioURL {
//                        isUploading = true
//                        AudioUploader.uploadAudio(url: url, userId: userId, sessionId: sessionId) { result in
//                            isUploading = false
//                            switch result {
//                            case .success(let data):
//                                uploadResult = "Success (\(data.count) bytes)"
//                                // Можно парсить JSON-ответ, если сервер его возвращает
//                            case .failure(let error):
//                                uploadResult = "Error: \(error.localizedDescription)"
//                            }
//                          print("Result:", result)
//                        }
//                    }
//                }
//                .foregroundColor(.red)
//            } else {
//                Button("Start Recording") {
//                    recorder.startRecording()
//                }
//                .foregroundColor(.blue)
//            }
//            
//            if isUploading {
//                ProgressView("Uploading...")
//            }
//            if let result = uploadResult {
//                Text(result)
//                    .font(.footnote)
//                    .foregroundColor(result.contains("Erorr") ? .red : .green)
//                    .padding(.top, 4)
//            }
//        }
//        .padding()
//    }
//}
