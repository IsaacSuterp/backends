import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Dados do administrador a ser criado
  const email = 'sarahmarry.loja@gmail.com';
  const plainPassword = '041220marry';
  const name = 'Administrador Tutty';
  const role: 'admin' = 'admin';

  // Verifica se o usuário já existe
  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    console.log('Usuário já existe:', email);
    return;
  }

  // Gera hash da senha
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // Cria usuário administrador
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role
    }
  });

  console.log('Admin seedado:', user);
}

main()
  .catch(error => {
    console.error('Erro ao seedar admin:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
