# Revolt Motors Voice Chatbot

**Author:** Ayisha Thesni Kozhikkoden

A real-time conversational voice interface built with the Gemini Live API, replicating the functionality of the Revolt Motors chatbot with natural speech interaction and interruption capabilities.

## 🎯 Project Overview

This project replicates the voice chat functionality found at [live.revoltmotors.com](https://live.revoltmotors.com/) using Google's Gemini Live API. The application provides a seamless voice interface for users to interact with an AI assistant focused on Revolt Motors products and services.

## ✨ Key Features

- **Real-time Voice Interaction**: Natural conversation flow with low latency (1-2 seconds response time)
- **Interruption Support**: Users can interrupt the AI mid-response, and the system will stop, listen, and respond appropriately
- **High-Quality Audio**: PCM16 audio format with 2-second response generation for crisp voice output
- **Revolt Motors Focus**: AI assistant specifically trained to discuss Revolt Motors products and services
- **Server-to-Server Architecture**: Secure implementation using Node.js/Express backend

## 🏗️ Architecture

```
Client (Browser) ↔ Node.js/Express Server ↔ Gemini Live API
```

The application uses a server-to-server architecture where:
- Frontend handles user interface and audio capture/playback
- Backend manages WebSocket connections and Gemini Live API communication
- All API communications are secured server-side

## 🚀 Technology Stack

- **Backend**: Node.js, Express.js
- **WebSocket**: Real-time bidirectional communication
- **API**: Google Gemini Live API (`gemini-2.5-flash-preview-native-audio-dialog`)
- **Frontend**: HTML5, JavaScript, Web Audio API
- **Audio Processing**: PCM16 format, native browser audio APIs

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- Google AI Studio API key
- Modern web browser with microphone access

## 🛠️ Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ayishathesni/Ai-Voice-chatbot.git
   cd Ai-Voice-chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3000
   ```

4. **Get your Gemini API Key**
   - Visit [aistudio.google.com](https://aistudio.google.com)
   - Create a free account and generate an API key
   - Add the key to your `.env` file

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 🎮 Usage

1. **Grant Microphone Permission**: When prompted, allow microphone access
2. **Start Conversation**: Click the "Start Voice Chat" button
3. **Speak Naturally**: Ask questions about Revolt Motors products
4. **Interrupt When Needed**: You can interrupt the AI at any time during its response
5. **End Session**: Click "Stop" to end the voice chat session

## 🔧 Configuration

### Model Selection

The application is configured to use `gemini-2.5-flash-preview-native-audio-dialog` for production. For development and testing, you can switch to:

- `gemini-2.0-flash-live-001`
- `gemini-live-2.5-flash-preview`

Update the model in `server.js`:
```javascript
const MODEL_NAME = 'gemini-2.5-flash-preview-native-audio-dialog';
```

### System Instructions

The AI is configured with specific instructions to focus conversations on Revolt Motors. These can be modified in the system prompt configuration.

## 📊 Performance Benchmarks

- **Response Latency**: 1-2 seconds (matching live.revoltmotors.com benchmark)
- **Interruption Response**: Near-instantaneous stop and listen capability
- **Audio Quality**: High-fidelity PCM16 voice synthesis with 2-second response generation

## 🧪 Testing

### Interactive Playground
Use the [Gemini Live Interactive Playground](https://aistudio.google.com/live) to test API behavior and experiment with different configurations.

### Rate Limits
- **Free Tier**: Limited requests per day with `gemini-2.5-flash-preview-native-audio-dialog`
- **Development**: Use alternative models for extensive testing
- **Production**: Consider upgrading to paid tier for higher limits

## 📝 API Documentation

- [Gemini Live API Documentation](https://ai.google.dev/gemini-api/docs/live)
- [Example Applications](https://ai.google.dev/gemini-api/docs/live#example-applications)

## 🎥 Demo

https://drive.google.com/file/d/1W1LDK0jOxCUKRkeowQCjJemWVhTU7evV/view?usp=drive_link

A demonstration showing:
- Natural conversation flow with the AI assistant
- Real-time interruption functionality working correctly
- Overall responsiveness and low latency performance
- Voice interaction with Revolt Motors focused responses

## 🗂️ Project Structure

```
Ai-Voice-chatbot/
├── server.js              # Main server file with Express and Gemini Live API integration
├── public/
│   └── index.html         # Frontend HTML with audio interface
├── .env                   # Environment variables (not included in repo)
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## 🚨 Known Issues & Limitations

- **Rate Limits**: Free tier has strict daily limits
- **Browser Compatibility**: Requires modern browsers with Web Audio API support
- **Network Dependency**: Requires stable internet connection for real-time functionality

## 🔮 Future Enhancements

- [ ] Multi-user support
- [ ] Conversation history
- [ ] Voice customization
- [ ] Mobile app version
- [ ] Analytics dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

**Copyright (c) 2025 Ayisha Thesni Kozhikkoden**

## 🙏 Acknowledgments

- Google Gemini Live API for providing the voice AI capabilities
- Revolt Motors for the original inspiration and benchmark
- AI development tools used in the creation process

## 📞 Support

For questions or issues:
- Create an issue in this repository
- Check the [Gemini Live API documentation](https://ai.google.dev/gemini-api/docs/live)
- Review the [interactive playground](https://aistudio.google.com/live) for API behavior

---

**Note**: This project was developed as part of an assessment to demonstrate proficiency in AI-assisted development and real-time voice interface implementation.