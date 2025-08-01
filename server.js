const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gemini Live API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-native-audio-dialog';
const isProduction = process.env.NODE_ENV === 'production';
const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

// System instructions for Revolt Motors context
const SYSTEM_INSTRUCTIONS = `You are Rev, the AI assistant for Revolt Motors, India's leading electric motorcycle company. 

About Revolt Motors:
- Founded to revolutionize urban mobility with electric motorcycles
- Offers eco-friendly, high-performance electric bikes
- Key models include RV400 and RV1+ with impressive range and speed
- Features like removable batteries, mobile app connectivity, and artificial exhaust sounds
- Booking available for just ₹499
- Focus on sustainability and reducing carbon footprint
- Strong presence across India with service centers and charging infrastructure

Your role:
- Help users learn about Revolt Motors' electric motorcycles
- Assist with product information, specifications, and features
- Guide users through the booking process
- Answer questions about electric mobility, sustainability, and benefits
- Maintain an enthusiastic, knowledgeable, and helpful tone
- Keep responses conversational and engaging
- If asked about topics outside Revolt Motors, politely redirect the conversation back to electric motorcycles and Revolt Motors

Always stay in character as Rev, the Revolt Motors assistant, and focus on helping users discover the future of electric mobility.`;

// Cache for setup messages
const setupCache = new Map();

// Generate mock PCM audio (440Hz sine wave, 16kHz, 2 seconds)
function generateMockPCMAudio() {
  const sampleRate = 16000;
  const duration = 2;
  const frequency = 440;
  const amplitude = 0.5;
  const samples = sampleRate * duration;
  const pcmData = new Int16Array(samples);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    pcmData[i] = Math.round(amplitude * 32767 * Math.sin(2 * Math.PI * frequency * t));
  }

  const buffer = Buffer.from(pcmData.buffer);
  console.log('Generated mock PCM audio, size:', buffer.length, 'bytes');
  return buffer.toString('base64');
}

// Generate silent PCM audio (16kHz, 1 second)
function generateSilentPCMAudio() {
  const sampleRate = 16000;
  const duration = 1;
  const samples = sampleRate * duration;
  const pcmData = new Int16Array(samples).fill(0); // Silent audio (all zeros)

  const buffer = Buffer.from(pcmData.buffer);
  console.log('Generated silent PCM audio, size:', buffer.length, 'bytes');
  return buffer.toString('base64');
}

// Gemini Live Session Class
class GeminiLiveSession {
  constructor(socketId) {
    this.socketId = socketId;
    this.ws = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryTimeout = null;
    this.setupConfig = {
      model: `models/${GEMINI_MODEL}`,
      systemInstruction: {
        parts: [
          { text: SYSTEM_INSTRUCTIONS },
          {
            inlineData: {
              mimeType: 'audio/pcm;rate=16000',
              data: generateSilentPCMAudio() // Include silent audio to satisfy audio-only model
            }
          }
        ]
      }
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      if (!GEMINI_API_KEY) {
        console.error(`No GEMINI_API_KEY provided for socket ${this.socketId}`);
        io.to(this.socketId).emit('session_error', { error: 'Missing Gemini API key' });
        reject(new Error('Missing Gemini API key'));
        return;
      }

      try {
        if (setupCache.has(this.socketId)) {
          console.log(`Using cached setup for socket ${this.socketId}`);
          io.to(this.socketId).emit('setup_complete');
          resolve();
          return;
        }

        console.log(`Connecting to Gemini WebSocket for socket ${this.socketId}`);
        this.ws = new WebSocket(GEMINI_WS_URL);

        this.ws.on('open', () => {
          console.log(`Gemini WebSocket connected for socket ${this.socketId}`);
          this.isConnected = true;
          this.retryCount = 0;

          const setupMessage = { setup: this.setupConfig };
          console.log(`Sending setup message for socket ${this.socketId}:`, JSON.stringify(setupMessage, null, 2));
          this.ws.send(JSON.stringify(setupMessage));
          setupCache.set(this.socketId, setupMessage);
          resolve();
        });

        this.ws.on('message', (data) => {
          console.log(`Raw Gemini message for socket ${this.socketId}:`, data.toString());
          try {
            const message = JSON.parse(data.toString());
            this.handleGeminiMessage(message);
          } catch (error) {
            console.error(`Error parsing Gemini message for socket ${this.socketId}:`, error);
            io.to(this.socketId).emit('session_error', { error: 'Failed to parse Gemini response' });
          }
        });

        this.ws.on('close', (code, reason) => {
          console.log(`Gemini WebSocket closed for socket ${this.socketId}, code: ${code}, reason: ${reason.toString()}`);
          this.isConnected = false;
          setupCache.delete(this.socketId);

          if (this.retryCount < this.maxRetries && code !== 1000) {
            this.retryCount++;
            console.log(`Retrying connection for socket ${this.socketId}, attempt ${this.retryCount}`);
            this.retryTimeout = setTimeout(() => {
              this.connect().catch(console.error);
            }, Math.pow(2, this.retryCount) * 30000); // Increased retry delay to 30s, 60s, 120s
          } else {
            let errorMessage = `Connection closed (code: ${code}, reason: ${reason.toString()})`;
            if (code === 1011 && reason.toString().includes('exceeded your current quota')) {
              errorMessage = 'Quota exceeded. Please upgrade your plan.';
            } else if (code === 1007) {
              errorMessage = 'Precondition check failed. Please verify the model and setup configuration.';
            }
            io.to(this.socketId).emit('session_error', { error: errorMessage });
          }
        });

        this.ws.on('error', (error) => {
          console.error(`Gemini WebSocket error for socket ${this.socketId}:`, error);
          this.isConnected = false;
          let errorMessage = `Connection error: ${error.message}`;
          if (error.message.includes('429')) {
            errorMessage = 'Rate limit exceeded. Please try again later.';
          } else if (error.message.includes('401') || error.message.includes('403')) {
            errorMessage = 'Invalid or expired API key. Please check your credentials in Google AI Studio.';
          }
          io.to(this.socketId).emit('session_error', { error: errorMessage });
          reject(error);
        });

      } catch (error) {
        console.error(`Error connecting to Gemini WebSocket for socket ${this.socketId}:`, error);
        io.to(this.socketId).emit('session_error', { error: 'Failed to connect to Gemini API' });
        reject(error);
      }
    });
  }

  handleGeminiMessage(message) {
    if (message.setupComplete) {
      console.log(`Setup complete for socket ${this.socketId}`);
      io.to(this.socketId).emit('setup_complete');
      return;
    }

    if (message.serverContent) {
      console.log(`Server content for socket ${this.socketId}:`, JSON.stringify(message.serverContent, null, 2));
      const content = message.serverContent;

      if (content.modelTurn && content.modelTurn.parts) {
        console.log(`Model turn parts for socket ${this.socketId}:`, content.modelTurn.parts);
        for (const part of content.modelTurn.parts) {
          if (part.inlineData && part.inlineData.mimeType.includes('audio')) {
            console.log(`Sending audio response for socket ${this.socketId}, data length: ${part.inlineData.data.length}, mimeType: ${part.inlineData.mimeType}`);
            io.to(this.socketId).emit('audio_response', {
              audioData: part.inlineData.data,
              mimeType: 'audio/pcm;rate=16000'
            });
          }
          if (part.text) {
            console.log(`Sending text response for socket ${this.socketId}:`, part.text);
            io.to(this.socketId).emit('text_response', { text: part.text });
          }
        }
      }

      if (content.interrupted) {
        console.log(`Interruption detected for socket ${this.socketId}`);
        io.to(this.socketId).emit('interrupted');
      }

      if (content.turnComplete) {
        console.log(`Turn complete for socket ${this.socketId}`);
        io.to(this.socketId).emit('turn_complete');
      }

      if (content.generationComplete) {
        console.log(`Generation complete for socket ${this.socketId}`);
        io.to(this.socketId).emit('generation_complete');
      }
    }
  }

  sendAudio(audioData, mimeType = 'audio/pcm;rate=16000') {
    if (!this.isConnected || !this.ws) {
      console.error(`Cannot send audio: WebSocket not connected for socket ${this.socketId}`);
      io.to(this.socketId).emit('session_error', { error: 'No active WebSocket connection' });
      return;
    }

    if (!mimeType.includes('audio/pcm;rate=16000')) {
      console.warn(`Invalid mimeType ${mimeType} for socket ${this.socketId}, forcing audio/pcm;rate=16000`);
      mimeType = 'audio/pcm;rate=16000';
    }

    const message = {
      clientContent: {
        turns: [{
          role: "user",
          parts: [{
            inlineData: {
              mimeType: mimeType,
              data: audioData
            }
          }]
        }],
        turnComplete: true
      }
    };

    try {
      this.ws.send(JSON.stringify(message));
      console.log(`Sent audio data for socket ${this.socketId}, size: ${audioData.length}, mimeType: ${mimeType}`);
    } catch (error) {
      console.error(`Error sending audio for socket ${this.socketId}:`, error);
      io.to(this.socketId).emit('session_error', { error: 'Failed to send audio' });
    }
  }

  sendText(text) {
    if (!this.isConnected || !this.ws) {
      console.error(`Cannot send text: WebSocket not connected for socket ${this.socketId}`);
      io.to(this.socketId).emit('session_error', { error: 'No active WebSocket connection' });
      return;
    }

    const message = {
      clientContent: {
        turns: [{
          role: "user",
          parts: [
            { text: text },
            {
              inlineData: {
                mimeType: 'audio/pcm;rate=16000',
                data: generateSilentPCMAudio() // Include silent audio for text requests
              }
            }
          ]
        }],
        turnComplete: true
      }
    };

    try {
      this.ws.send(JSON.stringify(message));
      console.log(`Sent text for socket ${this.socketId}:`, text);
    } catch (error) {
      console.error(`Error sending text for socket ${this.socketId}:`, error);
      io.to(this.socketId).emit('session_error', { error: 'Failed to send text' });
    }
  }

  disconnect() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
      this.isConnected = false;
      setupCache.delete(this.socketId);
      console.log(`Disconnected Gemini session for socket ${this.socketId}`);
    }
  }
}

// Mock Gemini Live Session for Testing (not used in production)
class MockGeminiLiveSession extends GeminiLiveSession {
  connect() {
    return new Promise((resolve) => {
      console.log(`Mock WebSocket connected for socket ${this.socketId}`);
      this.isConnected = true;
      io.to(this.socketId).emit('setup_complete');
      resolve();
    });
  }

  sendAudio(audioData, mimeType) {
    console.log(`Mock audio sent for socket ${this.socketId}, size: ${audioData.length}`);
    const mockResponse = {
      serverContent: {
        modelTurn: {
          parts: [
            { text: "Hey there! I'm Rev from Revolt Motors. Try asking about our electric motorcycles like the RV400!" },
            { inlineData: { mimeType: 'audio/pcm;rate=16000', data: generateMockPCMAudio() } }
          ]
        },
        turnComplete: true
      }
    };
    this.handleGeminiMessage(mockResponse);
  }

  sendText(text) {
    console.log(`Mock text sent for socket ${this.socketId}:`, text);
    if (text === '[INTERRUPT]' || text === '') {
      this.handleGeminiMessage({ serverContent: { interrupted: true } });
      return;
    }
    const mockResponse = {
      serverContent: {
        modelTurn: {
          parts: [{ text: `You said: "${text}". I'm Rev, tell me about your interest in Revolt Motors' electric bikes!` }]
        },
        turnComplete: true
      }
    };
    this.handleGeminiMessage(mockResponse);
  }
}

// Store active sessions
const activeSessions = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('start_session', async () => {
    try {
      const existingSession = activeSessions.get(socket.id);
      if (existingSession) {
        existingSession.disconnect();
      }

      const session = isProduction ? new GeminiLiveSession(socket.id) : new MockGeminiLiveSession(socket.id);
      await session.connect();
      activeSessions.set(socket.id, session);
      socket.emit('session_started');
    } catch (error) {
      console.error(`Failed to start session for ${socket.id}:`, error);
      socket.emit('session_error', { error: error.message });
    }
  });

  socket.on('send_audio', (data) => {
    const session = activeSessions.get(socket.id);
    if (session) {
      session.sendAudio(data.audioData, data.mimeType);
    } else {
      socket.emit('session_error', { error: 'No active session' });
    }
  });

  socket.on('send_text', (data) => {
    const session = activeSessions.get(socket.id);
    if (session) {
      session.sendText(data.text);
    } else {
      socket.emit('session_error', { error: 'No active session' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    const session = activeSessions.get(socket.id);
    if (session) {
      session.disconnect();
      activeSessions.delete(socket.id);
    }
  });
});

// Graceful shutdown
const shutdown = () => {
  console.log('Received shutdown signal, shutting down gracefully');
  for (const [socketId, session] of activeSessions.entries()) {
    session.disconnect();
  }
  activeSessions.clear();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

// Register handlers only once
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to test the application`);
  if (!GEMINI_API_KEY) {
    console.error('WARNING: GEMINI_API_KEY not found in environment variables');
    console.log('Please create a .env file with your Gemini API key:');
    console.log('GEMINI_API_KEY=your_api_key_here');
  }
});

module.exports = app;