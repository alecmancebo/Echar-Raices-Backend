import dotenv from "dotenv";
import { MongoClient } from "mongodb";

// CARGA DE VARIABLES DE ENTORNO
dotenv.config();

// CONFIGURACION DE CONEXION
const urlmongo = process.env.MONGO_URL;
let conexion;

// CONEXION UNICA A MONGODB
export async function conectarDB() {
    if (conexion) return conexion;
    
    try {
        const cliente = await MongoClient.connect(urlmongo);
        conexion = cliente.db("echar_raices"); 
        console.log("Conectado a la base de datos local (MongoClient)");
        return conexion;
    } catch (error) {
        console.error("Error conectando a MongoDB", error);
        throw error;
    }
}