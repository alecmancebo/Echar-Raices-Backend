import jwt from "jsonwebtoken";

export function verificarToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(403).json({ error: "Token ausente" });

    const token = authHeader.split(" ")[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuarioId = decoded.id; 
        next();
    } catch (e) {
        res.status(403).json({ error: "Token inválido" });
    }
}