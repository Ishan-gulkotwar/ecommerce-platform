# Full-Stack E-Commerce Platform

A modern e-commerce application built with React.js and Node.js, featuring secure authentication, real-time shopping cart functionality, and integrated payment processing.

## 🚀 Features

- **User Authentication**: Secure JWT-based authentication system
- **Product Management**: Browse products by categories with detailed views
- **Shopping Cart**: Real-time cart updates with persistent sessions
- **Payment Integration**: Secure checkout with Stripe payment processing
- **Order Management**: Track order history and status
- **Responsive Design**: Mobile-friendly UI with modern design patterns

## 🛠️ Tech Stack

### Frontend
- React.js with TypeScript
- Context API for state management
- React Router for navigation
- Tailwind CSS for styling
- Axios for API calls

### Backend
- Node.js & Express.js
- MongoDB with Mongoose
- JWT for authentication
- Stripe API for payments
- Bcrypt for password hashing

## 📦 Installation

1. Clone the repository

git clone https://github.com/Ishan-gulkotwar/ecommerce-platform.git
cd ecommerce-platform

2. Install dependencies for both client and server

Backend Setup:
cd server
npm install

Frontend Setup:
cd ../client
npm install

3. Set up environment variables

Create .env file in server directory:

PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

Create .env file in client directory:

REACT_APP_API_URL=http://localhost:5000

4. Run the application

Start Backend:
cd server
npm start

Start Frontend:
cd client
npm start

## 🔗 API Endpoints

### Authentication
- POST /api/auth/register - User registration
- POST /api/auth/login - User login

### Products
- GET /api/products - Get all products
- GET /api/products/:id - Get single product
- GET /api/categories - Get all categories

### Cart
- GET /api/cart - Get user cart
- POST /api/cart - Add to cart
- PUT /api/cart/:id - Update cart item
- DELETE /api/cart/:id - Remove from cart

### Orders
- POST /api/orders - Create order
- GET /api/orders - Get user orders

## 🚦 Running Tests

npm test


## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License.

## 👤 Author

**Ishan Gulkotwar**

- LinkedIn: [Ishan Gulkotwar](https://www.linkedin.com/in/ishan-gulkotwar-a202ba20a/)
- GitHub: [@Ishan-gulkotwar](https://github.com/Ishan-gulkotwar)
