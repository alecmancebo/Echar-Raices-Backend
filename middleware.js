import jwt from "jsonwebtoken";

export function verificarToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token no proporcionado o formato inválido" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded;
        req.usuarioId = decoded.id;
        next();
    } catch (e) {
        res.status(403).json({ error: "Token inválido" });
    }
}