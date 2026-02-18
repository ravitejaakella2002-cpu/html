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

async function handleUserCart(
  userId: number,
  items: CartItemInput[]
) {
  let cart = await Cart.findOne({ where: { userId } });

  if (!cart) {
    cart = await Cart.create({ userId });
  }

  const updatedItems = [];

  for (const item of items) {
    const { productId, quantity } = item;

    if (!productId || quantity <= 0) {
      throw new Error("Invalid product or quantity");
    }

    const product = await Product.findByPk(productId);

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    if (product.quantity < quantity) {
      throw new Error(`Insufficient stock for product ${productId}`);
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

      updatedItems.push(existingItem);
    } else {
      const price = product.price * quantity;

      const newItem = await CartItem.create({
        cartId: cart.id,
        productId,
        quantity,
        price,
      });

      updatedItems.push(newItem);
    }
  }

  return {
    type: "user",
    cartId: cart.id,
    items: updatedItems,
  };
  }

async function handleGuestCart(
  req: Request,
  items: CartItemInput[]
) {
  if (!req.session.cart) {
    req.session.cart = [];
  }

  for (const item of items) {
    const { productId, quantity } = item;

    if (!productId || quantity <= 0) {
      throw new Error("Invalid product or quantity");
    }

    const product = await Product.findByPk(productId);

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    if (product.quantity < quantity) {
      throw new Error(`Insufficient stock for product ${productId}`);
    }

    const existingIndex = req.session.cart.findIndex(
      (cartItem: any) => cartItem.productId === productId
    );

    if (existingIndex !== -1) {
      req.session.cart[existingIndex].quantity += quantity;
    } else {
      req.session.cart.push({
        productId,
        quantity,
      });
    }
  }

  return {
    type: "guest",
    cart: req.session.cart,
  };
}
