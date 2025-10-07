//Database Connection Management

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export default prisma;

//why we are using this :- Prevents duplicate connections, simplifies configuration, improves performance