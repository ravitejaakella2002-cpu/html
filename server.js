const http = require("http");

let users = [
  { id: 1, name: "Ravi", age: 23 },
  { id: 2, name: "Teja", age: 24 }
];

const AUTH_USER = {
  username: "admin",
  password: "1234"
};

async function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}


function send(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
const server = http.createServer(async (req, res) => {
  const { method, url } = req;

 
  console.log("REQUEST:", req.method, req.url);

  if (method === "POST" && url === "/api/v1/login") {
    const body = await readBody(req);

    if (body.username === AUTH_USER.username && body.password === AUTH_USER.password) {
      return send(res, 200, { message: "Login successful" });
    }
    return send(res, 401, { message: "Invalid username or password" });
  }


  if (method === "DELETE" && url === "/api/v1/logout") {
    return send(res, 200, { message: "Logged out successfully" });
  }

  if (method === "GET" && url === "/api/v1/users") {
    return send(res, 200, users);
  }

  if (method === "GET" && url.startsWith("/api/v1/users/")) {
    const id = parseInt(url.split("/")[4]);
    const user = users.find(u => u.id === id);

    if (!user) return send(res, 404, { message: "User not found" });

    return send(res, 200, user);
  }

  if (method === "POST" && url === "/api/v1/users") {
    const body = await readBody(req);

    const newUser = {
      id: users.length + 1,
      name: body.name,
      age: body.age
    };

    users.push(newUser);
    return send(res, 201, newUser);
  }

  send(res, 404, { message: "Route not found" });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});


import { Request, Response } from "express";
import { Cart } from "../models/Cart";
import { CartItem } from "../models/CartItem";
import { Product } from "../models/Product";

export const addMultipleItemsToCart = async (
  req: Request<{}, {}, AddToCartBody>,
  res: Response
): Promise<void> => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: "Items array is required" });
      return;
    }

    const userId = (req as any).user?.id; // adjust if you have custom type
    const sessionId = req.sessionID;

    let cart;

    // 🔹 Find or create cart
    if (userId) {
      cart = await Cart.findOne({ where: { userId } });
      if (!cart) {
        cart = await Cart.create({ userId });
      }
    } else {
      cart = await Cart.findOne({ where: { sessionId } });
      if (!cart) {
        cart = await Cart.create({ sessionId });
      }
    }

    const addedItems = [];

    for (const item of items) {
      const { productId, quantity } = item;

      if (!productId || !quantity || quantity <= 0) {
        res.status(400).json({ message: "Invalid product or quantity" });
        return;
      }

      const product = await Product.findByPk(productId);

      if (!product) {
        res.status(404).json({ message: `Product ${productId} not found` });
        return;
      }

      const existingItem = await CartItem.findOne({
        where: {
          cartId: cart.id,
          productId,
        },
      });

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        const newPrice = product.price * newQuantity;

        await existingItem.update({
          quantity: newQuantity,
          price: newPrice,
        });

        addedItems.push(existingItem);
      } else {
        const price = product.price * quantity;

        const newItem = await CartItem.create({
          cartId: cart.id,
          productId,
          quantity,
          price,
        });

        addedItems.push(newItem);
      }
    }

    res.status(200).json({
      message: "Cart updated successfully",
      cartId: cart.id,
      items: addedItems,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
