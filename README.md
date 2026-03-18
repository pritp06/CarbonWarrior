CarbonWarrior

A web-based environmental intelligence platform that analyzes aircraft routes, fuel consumption, and carbon emissions to promote smarter and more sustainable aviation decisions.

Live Demo

https://carbonwarrior.vercel.app/

Overview

CarbonWarrior is designed to visualize and analyze aviation data with a focus on environmental impact. It helps in understanding fuel usage, CO₂ emissions, and route efficiency using simple datasets and interactive UI.

The project combines frontend visualization with backend logic to simulate real-world aviation analytics.

Features:-
 Aircraft route visualization
 Fuel consumption analysis
 CO₂ emission estimation
 Data-driven insights using JSON datasets
 Smart logic for route comparison
 Interactive frontend interface
 Lightweight and fast performance

Tech Stack
Frontend:-
HTML
CSS
JavaScript

Backend:-
Python (Flask)

Database:-
JSON-based data storage
Other Tools:
Antigravity (for UI/logic inspiration)
ChatGpt

Project Structure:-

CarbonWarrior/
│── static/              
│── templates/           
│── data/                
│── app.py               
│── requirements.txt     
│── README.md            

How It Works:-
Aircraft and route data are stored in JSON format
Flask processes requests and performs calculations
Frontend fetches processed data
Results are displayed with visual insights

Core Logic:-
Distance calculated using route data
Fuel consumption based on aircraft type
CO₂ emissions derived from fuel usage
Comparison between multiple routes for optimization

Installation & Setup:-
# Clone the repository
git clone https://github.com/pritp06/CarbonWarrior.git

# Navigate to project folder
cd CarbonWarrior

# Install dependencies
pip install -r requirements.txt

# Run the Flask app
python app.py

Future Improvements:-
Real-time flight data integration
Advanced analytics dashboard
Machine learning for route optimization
API integration for weather and air traffic
Database upgrade (SQL/NoSQL)

Author:-
Prit Patel

License:-
This project is for educational and research purposes.

ChatGPT (for AI-assisted code generation and problem-solving)
