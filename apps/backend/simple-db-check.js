import { PrismaClient } from '@prisma/client';

async function checkDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== DATABASE CHECK ===\n');
    
    // Check for open orders
    const openOrders = await prisma.userOrder.findMany({
      include: {
        user: {
          select: {
            email: true,
            id: true
          }
        }
      }
    });
    console.log(`Open Orders Count: ${openOrders.length}`);
    if (openOrders.length > 0) {
      console.log('First few open orders:');
      openOrders.slice(0, 3).forEach(order => {
        console.log(`- ID: ${order.id}, User: ${order.user.email}, Asset: ${order.asset}, Amount: $${order.margin}, Type: ${order.orderType}`);
      });
    }
    
    console.log('\n');
    
    // Check for closed orders
    const closedOrders = await prisma.closedOrder.findMany({
      take: 5,
      orderBy: {
        closedAt: 'desc'
      },
      include: {
        user: {
          select: {
            email: true,
            id: true
          }
        }
      }
    });
    console.log(`Closed Orders Count: ${closedOrders.length}`);
    if (closedOrders.length > 0) {
      console.log('Latest closed orders:');
      closedOrders.forEach(order => {
        console.log(`- ID: ${order.id}, User: ${order.user.email}, Asset: ${order.asset}, Amount: $${order.margin}, PnL: $${order.pnl}`);
      });
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();