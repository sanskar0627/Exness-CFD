import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();  //created one shared instance
export * from "@prisma/client"; //exporting eveything
