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

export const mergeCart = async (
  sessionId: string,
  userId: bigint,
  res: Response
): Promise<void> => {
  try {
    // 1️⃣ Get session cart
    const sessionCart = await cartService.getCartBySessionId(sessionId);
    if (!sessionCart) return;

    const sessionItems = await cartItemsService.getCartItems(sessionCart.id);

    if (sessionItems.length === 0) return;

    // 2️⃣ Get or create user cart
    const userCart = await cartService.getOrCreateUserCart(userId);
    const userItems = await cartItemsService.getCartItems(userCart.id);

    // 3️⃣ Create map for quick lookup
    const userItemMap = new Map(
      userItems.map(item => [item.productId, item])
    );

    const mergedItems = [];

    for (const item of sessionItems) {
      const existing = userItemMap.get(item.productId);

      if (existing) {
        mergedItems.push({
          cartId: userCart.id,
          productId: item.productId,
          quantity: existing.quantity + item.quantity
        });
      } else {
        mergedItems.push({
          cartId: userCart.id,
          productId: item.productId,
          quantity: item.quantity
        });
      }
    }

    // 4️⃣ Bulk upsert
    await cartItemsService.bulkUpsertCartItems(mergedItems);

    // 5️⃣ Delete session cart
    await cartService.deleteCartBySessionId(sessionId);

  } catch (error: unknown) {
    const { status, body } = formatError(error);
    res.status(status).json(body);
  }
};
