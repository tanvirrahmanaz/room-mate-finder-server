# Room Mate Finder - Server

Backend server for the Room Mate Finder application. Built with Node.js, Express, and MongoDB.

## Live API
[Room Mate Finder API](https://room-mate-finder-server.vercel.app/)

## Features

- 🔒 **Secure Authentication System**
  - JWT-based authentication
  - Password hashing with bcrypt
  - Protected API endpoints
  - User session management

- 🏠 **Room Management API**
  - CRUD operations for room listings
  - Image upload and management
  - Room availability tracking
  - Advanced filtering and search endpoints

- 👥 **User Management**
  - User registration and profile management
  - Role-based access control
  - User preferences and settings
  - Profile verification system

- 🔍 **Advanced Search & Filtering**
  - RESTful API endpoints for room search
  - Filtering by multiple criteria
  - Sorting and pagination support
  - Real-time data updates

- 📊 **Data Management**
  - MongoDB database integration
  - Data validation and sanitization
  - Error handling and logging
  - API rate limiting

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- Bcrypt
- Multer
- Cors
- Dotenv

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Rooms
- `GET /api/rooms` - Get all rooms
- `POST /api/rooms` - Create new room
- `GET /api/rooms/:id` - Get room by ID
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## Getting Started

1. Clone the repository
```bash
git clone https://github.com/your-username/room-mate-finder-server.git
```

2. Install dependencies
```bash
cd room-mate-finder-server
npm install
```

3. Create a `.env` file in the root directory and add your environment variables:
```env
PORT=3000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
```

4. Start the development server
```bash
npm run dev
```

## Project Structure

```
room-mate-finder-server/
├── src/
│   ├── config/        # Configuration files
│   ├── controllers/   # Route controllers
│   ├── middleware/    # Custom middleware
│   ├── models/        # Database models
│   ├── routes/        # API routes
│   ├── utils/         # Utility functions
│   └── app.js         # Express app
├── uploads/           # Uploaded files
└── .env              # Environment variables
```

## Database Schema

### User Schema
```javascript
{
  name: String,
  email: String,
  password: String,
  role: String,
  createdAt: Date
}
```

### Room Schema
```javascript
{
  title: String,
  description: String,
  location: String,
  price: Number,
  roomType: String,
  availability: Boolean,
  owner: ObjectId,
  images: [String],
  createdAt: Date
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 