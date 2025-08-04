/**
 * prisma/seed.ts
 *
 * Script de seeding para popular a base de dados com produtos iniciais,
 * incluindo descrições detalhadas.
 *
 * Requisitos:
 *  - @types/node instalado em devDependencies
 *  - "types": ["node"] em compilerOptions no tsconfig.json
 */

/// <reference types="node" />
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Interface para definição de um produto de seed
 */
interface SeedProduct {
  id: number;
  name: string;
  slug: string;                // URL amigável gerada a partir do nome
  price: number;
  imageUrl: string;
  category: string;
  description: string;
}

/**
 * Função utilitária para gerar slugs a partir do nome
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // substitui não-alfanuméricos por hífen
    .replace(/(^-|-$)+/g, '');    // remove hífens no início/fim
}

/**
 * Dados iniciais de produtos para inserção
 */
const productsData: SeedProduct[] = [
  {
    id: 1,
    name: 'Pijama Plush Off Masculino',
    slug: generateSlug('Pijama Plush Off Masculino'),
    price: 159.9,
    imageUrl: 'pijama-01.jpg',
    category: 'Inverno Masculino',
    description:
      'Confeccionado em plush extra macio, este pijama vai manter você aquecido e confortável nas noites mais frias.',
  },
  {
    id: 2,
    name: 'Pijama Plush Rosa Escurecido Feminino',
    slug: generateSlug('Pijama Plush Rosa Escurecido Feminino'),
    price: 159.9,
    imageUrl: 'pijama-02.jpg',
    category: 'Inverno Feminino',
    description:
      'Tons suaves e toque aveludado: a combinação perfeita para relaxar com estilo e aconchego absoluto.',
  },
  {
    id: 3,
    name: 'Pijama Baseball Infantil',
    slug: generateSlug('Pijama Baseball Infantil'),
    price: 119.9,
    imageUrl: 'pijama-03.jpg',
    category: 'Infantil Inverno Masculino',
    description:
      'Estampa divertida de baseball que agrada a garotada, junto a um tecido leve para aventuras e sonhos tranquilos.',
  },
  {
    id: 4,
    name: 'Pijama Hello Kitty Infantil',
    slug: generateSlug('Pijama Hello Kitty Infantil'),
    price: 119.9,
    imageUrl: 'pijama-04.jpg',
    category: 'Infantil Inverno Feminino',
    description:
      'Apresenta a icônica Hello Kitty em um design fofo, feito em algodão respirável para conforto durante toda a noite.',
  },
  {
    id: 5,
    name: 'Pijama Plush Off Feminino',
    slug: generateSlug('Pijama Plush Off Feminino'),
    price: 159.9,
    imageUrl: 'pijama-05.jpg',
    category: 'Inverno Feminino',
    description:
      'Detalhes delicados e plush supermacio: ideal para quem busca charme e quentinho no outono e inverno.',
  },
  {
    id: 6,
    name: 'Pijama Rosa Envelhecido Feminino',
    slug: generateSlug('Pijama Rosa Envelhecido Feminino'),
    price: 159.9,
    imageUrl: 'pijama-06.jpg',
    category: 'Inverno Feminino',
    description:
      'Rosa envelhecido suave com acabamento em plush, garantindo elegância e aconchego nas estações frias.',
  },
  {
    id: 7,
    name: 'Pijama Plush Estrela Feminino',
    slug: generateSlug('Pijama Plush Estrela Feminino'),
    price: 159.9,
    imageUrl: 'pijama-07.jpg',
    category: 'Inverno Feminino',
    description:
      'Estrelas bordadas e plush de alta gramatura: perfeito para noites estreladas envoltas em conforto premium.',
  },
];

/**
 * Função principal de seeding
 */
async function main(): Promise<void> {
  console.log('🔄 Iniciando seeding de produtos...');

  for (const product of productsData) {
    try {
      await prisma.product.create({
        data: {
          id: product.id,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
          category: product.category,
          description: product.description,
        },
      });
      console.log(`✅ Produto criado: [${product.id}] ${product.name}`);
    } catch (error: any) {
      console.error(
        `❌ Falha ao criar produto [${product.id}] ${product.name}:`,
        error
      );
    }
  }

  console.log('🎉 Seeding concluído com sucesso.');
}

// Execução da função main, tratamento de erros e desconexão
main()
  .catch((error) => {
    console.error('🚨 Erro não tratado no seeding:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Desconectado do banco de dados.');
  });
