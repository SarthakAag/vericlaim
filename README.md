# VeriClaim AI

### Real-Time Fraud-Aware Income Protection for Gig Workers

VeriClaim AI is an intelligent **parametric insurance platform** for gig economy workers. It leverages real-time data, machine learning, and fraud detection to **automatically detect risks, trigger claims, and process payouts instantly**.

## Problem Statement

Gig workers (delivery partners, drivers, etc.) face **unstable income** due to:

* Weather disruptions
* Traffic congestion
* Delivery delays & demand fluctuations

### Current Challenges:

* Manual claim filing 
* Slow processing 
* High fraud risk 


## Solution

VeriClaim AI introduces a **fully automated, AI-driven insurance system**.


### Real-Time Risk Detection

* Uses **weather, traffic, and location data**
* Predicts delivery disruptions dynamically


### Automated Claim Processing

* Claims are **triggered automatically**
* No manual filing required


### Fraud Detection System

Hybrid **rule-based + ML system**:

* Speed vs weather mismatch
* Traffic inconsistency
* High claim frequency
* Behavioral anomaly detection

#### Outputs:

* Fraud Score
* Risk Level (Low / Medium / High)
* Explainable Flags


### Instant Payout Engine

* Automated payout calculation
* Smart decision system:

  * Approved
  * Held for review
  * Rejected


### Admin Dashboard

* Real-time trigger monitoring
* Fraud alert system
* Claim & payout tracking
* Fraud analytics


### Interactive UI

* Risk Map (Chennai zones)
* Earnings tracking
* Fraud insights panel


## Tech Stack

### Frontend

* Next.js
* TypeScript
* Tailwind CSS

### Backend

* FastAPI (Python)
* REST APIs
* Modular Architecture

### AI / ML

* Scikit-learn
* Custom ML Risk Models
* Hybrid Fraud Detection System

### Data Sources

* WeatherAPI (Real-time weather)
* Traffic Simulation Engine
* GPS-based Location Logic

### Database

* PostgreSQL


## Project Structure

<img width="376" height="691" alt="Screenshot 2026-04-17 214650" src="https://github.com/user-attachments/assets/993380db-a7b2-4639-934a-80c764bddc22" />
<img width="365" height="686" alt="Screenshot 2026-04-17 214705" src="https://github.com/user-attachments/assets/f21fe9d9-5d2d-4b17-bbe3-e22a7f86b1c6" />
<img width="374" height="679" alt="Screenshot 2026-04-17 214718" src="https://github.com/user-attachments/assets/41ca0d13-8f92-4d89-abe6-597e159f6414" />



## Installation & Setup

### Clone Repository

bash
git clone https://github.com/SarthakAag/vericlaim
cd vericlaim


### Backend Setup

bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload


### Frontend Setup

bash
cd frontend
npm install
npm run dev


## Demo Features

* Real-time Trigger Engine
* ML-based Risk Detection
* Fraud Classification (Approved / Held / Rejected / Escalated)
* Automated Payout System
* Live Admin Dashboard

## Future Plans

* Real API integrations (Weather, Traffic)
* Advanced ML (deep anomaly detection)
* Hyperlocal risk prediction
* Payment integration (UPI / Razorpay)
* Mobile application
* Integration with gig platforms


## Built With

**Next.js, TypeScript, FastAPI, PostgreSQL, Modular Architecture, Custom ML Models, Hybrid Fraud Detection, WeatherAPI, Traffic Simulation, and GPS-based Logic**



