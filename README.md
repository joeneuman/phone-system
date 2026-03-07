# Giddy Phone System

A self-hosted, OpenPhone-style web phone system powered by Twilio. Make and receive phone calls directly in your browser, send/receive SMS with conversation threads, manage contacts, view call history, and listen to voicemails with transcriptions.

## Features

- **Browser Softphone** - Make and receive calls via WebRTC (no SIP client needed)
- **SMS Messaging** - Send/receive texts with threaded conversation view
- **Contacts** - Full contact management with search
- **Call History** - Logged inbound/outbound calls with duration tracking
- **Voicemail** - Automatic voicemail when calls go unanswered, with playback and transcription
- **Real-time** - WebSocket-driven live updates for incoming messages and calls
- **Dark UI** - Clean, modern dark theme inspired by OpenPhone

## Architecture

```
client/ (React)               server/ (NestJS)              Twilio
├── Twilio Voice SDK  ←→  ├── Token endpoint          ←→  Voice (WebRTC)
├── Socket.io client  ←→  ├── WebSocket gateway       
├── REST API calls    ←→  ├── REST controllers        ←→  Messaging API
                          ├── Webhook controllers     ←←  Webhooks
                          └── MongoDB (contacts, messages, calls, voicemails)
```

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Twilio Account with:
  - Account SID + Auth Token
  - API Key + API Secret (for Access Tokens)
  - TwiML App SID (for browser-to-PSTN calling)
  - A phone number (+14352558888)
- ngrok or similar tunnel for webhooks in development

## Twilio Setup

### 1. Create API Key

Go to [Twilio Console > API Keys](https://www.twilio.com/console/project/api-keys) and create a new Standard key. Save the **SID** (this is your API Key) and **Secret**.

### 2. Create a TwiML App

Go to [Twilio Console > TwiML Apps](https://www.twilio.com/console/voice/twiml/apps) and create a new TwiML App:

- **Voice Request URL**: `https://YOUR_PUBLIC_URL/api/webhooks/twilio/voice`
- **Voice Method**: POST

Save the **TwiML App SID**.

### 3. Configure Your Phone Number

Go to your phone number's configuration in the Twilio Console:

- **Voice & Fax > A Call Comes In**: Webhook → `https://YOUR_PUBLIC_URL/api/webhooks/twilio/voice/incoming` (POST)
- **Voice & Fax > Call Status Changes**: `https://YOUR_PUBLIC_URL/api/webhooks/twilio/voice/status` (POST)
- **Messaging > A Message Comes In**: Webhook → `https://YOUR_PUBLIC_URL/api/webhooks/twilio/sms` (POST)

### 4. Start ngrok (for development)

```bash
ngrok http 3200
```

Use the ngrok HTTPS URL as your `PUBLIC_URL`.

## Installation

### Backend

```bash
cd server
cp .env.template .env
# Edit .env with your actual credentials
npm install
npm run start:dev
```

### Frontend

```bash
cd client
npm install
npm start
```

The frontend runs on `http://localhost:3001` and the backend on `http://localhost:3200`.

## Environment Variables

Copy `server/.env.template` to `server/.env` and fill in:

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token |
| `TWILIO_API_KEY` | API Key SID (for Access Tokens) |
| `TWILIO_API_SECRET` | API Key Secret |
| `TWILIO_TWIML_APP_SID` | TwiML App SID (for outbound calls) |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number (E.164) |
| `PUBLIC_URL` | Public URL where Twilio can reach webhooks |
| `MONGODB_URI` | MongoDB connection string |
| `PORT` | Server port (default: 3200) |
| `CLIENT_URL` | Frontend URL for CORS (default: http://localhost:3001) |

## How It Works

### Voice Calls

**Outbound**: Browser → Twilio Voice SDK → TwiML App webhook → Server generates TwiML → Twilio connects to PSTN

**Inbound**: PSTN → Twilio → Incoming voice webhook → Server generates TwiML to ring browser client → If no answer after 25s, routes to voicemail

### SMS

**Outbound**: Browser → Server API → Twilio REST API → Recipient

**Inbound**: Sender → Twilio → SMS webhook → Server stores message → WebSocket pushes to browser

### Voicemail

When an incoming call isn't answered within 25 seconds, Twilio plays a greeting and records the message. Twilio also transcribes the recording and sends the transcription via webhook. Both are stored and displayed in the voicemail tab.

## Important Note About the 855 Number

The Giddy Digs 855 number (+18553591973) has its own SMS auto-responder webhook. This phone system is configured for the 8888 number only. Do NOT change the 855 number's webhook configuration in Twilio.
