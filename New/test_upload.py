import requests

url = "http://localhost:8000/api/questions/upload"
file_path = r"c:\Users\Varun Kumar\OneDrive\Desktop\master quiz\Master-Quiz\New\test_questions.csv"

# First we need to log in to get a token, the endpoint is auth required
login_url = "http://localhost:8000/api/auth/login"
login_data = {
    "username": "admin",
    "password": "admin@2024" # Default password from main.py seed_users()
}

try:
    print("Logging in...")
    login_res = requests.post(login_url, json=login_data)
    login_res.raise_for_status()
    token = login_res.json().get("access_token")
    print("Login successful.")

    headers = {
        "Authorization": f"Bearer {token}"
    }

    print("Uploading file...")
    with open(file_path, "rb") as f:
        files = {"file": ("test_questions.csv", f, "text/csv")}
        res = requests.post(url, headers=headers, files=files)
        
    print(f"Status Code: {res.status_code}")
    print(f"Response: {res.json()}")
    
except Exception as e:
    print(f"Error: {e}")
