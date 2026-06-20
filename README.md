# AttendPro - Employee Attendance Management System

A full-stack MERN application for managing employee attendance with role-based access control.

## 🚀 Live Demo
[https://attendance-system-seven-mocha.vercel.app](https://attendance-system-seven-mocha.vercel.app)

## 📸 Screenshots


## 🛠️ Tech Stack

**Frontend:**
- React 19 + Vite
- Tailwind CSS
- React Router DOM
- Axios
- React Hot Toast
- React Icons

**Backend:**
- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- bcrypt

**Deployment:**
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## ✨ Features

- **JWT Authentication** — secure login with token-based auth
- **Role-Based Access Control** — staff, HR, and superadmin roles
- **Clock In/Out** — real-time attendance tracking with hours calculation
- **KPI Dashboard** — weekly hours, punctuality streak, attendance rate
- **HR Dashboard** — HR managers can view all employees' attendance
- **Responsive Design** — works on mobile and desktop
- **Toast Notifications** — professional UX feedback

## 🔑 Test Credentials

**Staff Account:**
- Email: godfredagyemang31052005@gmail.com
- Password: Godfred123456

**HR Account:**
- Email: OliTech@gmail.com
- Password: Olives12345

  **Super Admin**
  -Email : josephamoah123@gmail.com
  -Password :Amoah123

## 🚀 Running Locally

### Prerequisites
- Node.js installed
- MongoDB Atlas account

### Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the backend folder:
```
PORT=8000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```bash
node server.js
```

### Frontend Setup
```bash
npm install
npm run dev
```

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /api/auth/login | Login user | Public |

### Users
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /api/users | Register user | Public |
| GET | /api/users | Get all users | HR, Superadmin |
| GET | /api/users/:id | Get single user | All roles |
| PUT | /api/users/:id | Update user | All roles |
| DELETE | /api/users/:id | Delete user | Superadmin |
| PUT | /api/users/change-password | Change password | All roles |

### Attendance
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /api/attendance/clock-in | Clock in | All roles |
| POST | /api/attendance/clock-out | Clock out | All roles |
| GET | /api/attendance/my-attendance | Get own attendance | All roles |
| GET | /api/attendance/all-attendance | Get all attendance | HR, Superadmin |

## 👨‍💻 Author

**Godfred Agyemang**

- GitHub: [https://github.com/Agyemang8172/Inventory-Management]

## 📝 License
MIT