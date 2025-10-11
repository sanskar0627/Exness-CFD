import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOrderHistory() {
  try {
    console.log('=== CHECKING ORDER HISTORY ===');
    
    const userId = '17f22892-3da9-4eb3-9d35-c514bb922285'; // Your original user
    const newUserId = 'e27d0639-b16d-4e36-bfe7-3ad36ab4b95d'; // New user
    
    // Check open orders for original user
    console.log('\n1. OPEN ORDERS (UserOrder table):');
    const openOrders = await prisma.userOrder.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Found ${openOrders.length} open orders for original user:`);
    openOrders.forEach((order, i) => {
      console.log(`  ${i + 1}. ${order.asset} ${order.orderType} - Status: ${order.status} - Created: ${order.createdAt}`);
    });
    
    // Check closed orders for original user
    console.log('\n2. CLOSED ORDERS (ClosedOrder table):');
    const closedOrders = await prisma.closedOrder.findMany({
      where: { userId: userId },
      orderBy: { closedAt: 'desc' }
    });
    
    console.log(`Found ${closedOrders.length} closed orders for original user:`);
    closedOrders.forEach((order, i) => {
      console.log(`  ${i + 1}. ${order.asset} ${order.orderType} - PnL: $${Number(order.pnl) / 100} - Closed: ${order.closedAt}`);
    });
    
    // Check new user orders
    console.log('\n3. NEW USER ORDERS:');
    const newUserOpenOrders = await prisma.userOrder.findMany({
      where: { userId: newUserId }
    });
    const newUserClosedOrders = await prisma.closedOrder.findMany({
      where: { userId: newUserId }
    });
    
    console.log(`New user open orders: ${newUserOpenOrders.length}`);
    console.log(`New user closed orders: ${newUserClosedOrders.length}`);
    
    // Check all users' orders
    console.log('\n4. ALL USERS ORDER SUMMARY:');
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true }
    });
    
    for (const user of allUsers) {
      const userOpenOrders = await prisma.userOrder.count({
        where: { userId: user.id }
      });
      const userClosedOrders = await prisma.closedOrder.count({
        where: { userId: user.id }
      });
      
      console.log(`${user.email}: ${userOpenOrders} open, ${userClosedOrders} closed`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrderHistory();