# VeriClaim AI

### Real-Time Fraud-Aware Income Protection for Gig Workers

VeriClaim AI is an intelligent parametric insurance platform designed for gig economy workers. It uses real-time data, AI models, and fraud detection systems to automatically detect risks, trigger claims, and ensure fair payouts.


## Problem Statement

Gig workers (delivery partners, drivers, etc.) face unstable income due to:

- Weather disruptions  
- Traffic congestion  
- Delays and reduced demand  

Current systems:
- Require **manual claim filing**
- Are **slow and inefficient**
- Are vulnerable to **fraud and misuse**


## Solution

VeriClaim AI provides a **fully automated, AI-powered insurance system**:

### Real-Time Risk Detection
- Uses weather, traffic, and location data  
- Predicts delivery delays dynamically  

### Automated Claim Processing
- Claims are triggered automatically  
- No manual intervention required  

### Fraud Detection System
- Multi-layer fraud engine:
  - Speed vs weather mismatch  
  - High claim frequency  
  - Traffic inconsistency  
  - Behavioral anomaly detection  

- Outputs:
  - Fraud score  
  - Risk level  
  - Explainable insights  

### Instant Payout Engine
- Calculates payouts automatically  
- Approves / flags / rejects claims  

### Admin Fraud Portal
- Real-time fraud alerts 🚨  
- Claim monitoring dashboard  
- Fraud analytics & insights  
- Suspicious user detection  

### Interactive Dashboard
- Risk map visualization  
- Earnings tracking  
- Fraud insights panel  


## Tech Stack

### Frontend
- Next.js (React)
- TypeScript
- Tailwind CSS

### Backend
- FastAPI (Python)
- REST APIs
- Modular architecture

### AI / ML
- Scikit-learn
- Custom risk prediction models
- Hybrid fraud detection system

### Data Sources
- Weather API
- Traffic simulation
- Location-based logic

### Database
- PostgreSql

## Project Structure

<img width="381" height="689" alt="Screenshot 2026-04-04 180926" src="https://github.com/user-attachments/assets/48e98d50-cc02-4656-8c60-ff590f04391a" />
<img width="372" height="599" alt="Screenshot 2026-04-04 180936" src="https://github.com/user-attachments/assets/c7e96252-7bf0-4652-9272-e1da5635600a" />
<img width="367" height="603" alt="Screenshot 2026-04-04 181003" src="https://github.com/user-attachments/assets/a75fa8d8-d480-43c9-bf29-0af65e876157" />
<img width="396" height="630" alt="Screenshot 2026-04-04 180944" src="https://github.com/user-attachments/assets/59b40896-9258-4ee3-ac77-037b7db50a5c" />



## Installation & Setup

1️ Clone the repository
bash
git clone https://github.com/your-username/vericlaim.git
cd vericlaim

2️.Backend Setup

cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload

3️.Frontend Setup

cd frontend
npm install
npm run dev

###Future Plans
Real API integration (Weather, Traffic)
Advanced ML models (anomaly detection)
Hyperlocal risk prediction
Payment integration (Razorpay / UPI)
Mobile application
Integration with gig platforms
