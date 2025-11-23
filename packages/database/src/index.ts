import { PrismaClient } from "../generated/prisma/index.js";
export const prisma = new PrismaClient(); //created one shared instance
export * from "../generated/prisma/index.js"; //exporting eveything
 