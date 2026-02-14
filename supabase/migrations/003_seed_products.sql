-- Seed inicial de produtos (100% cloud)
-- Rode no SQL Editor do Supabase

insert into public.products (
  id, nome, categoria, preco, preco_original, desconto, imagem, descricao,
  popularity_score, stock, is_active, is_featured
) values
  (1, 'iPhone 15 Pro', 'smartphones', 7999, 8999, 11, 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400', 'Smartphone Apple com camera avancada', 50, 12, true, true),
  (2, 'MacBook Air M2', 'laptops', 8999, 10999, 18, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400', 'Notebook Apple ultrafino e potente', 30, 5, true, true),
  (3, 'AirPods Pro', 'headphones', 1899, 2299, 17, 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400', 'Fones sem fio com cancelamento de ruido', 80, 20, true, false),
  (4, 'Samsung Galaxy S24', 'smartphones', 5499, 6299, 13, 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400', 'Smartphone Samsung com tela AMOLED', 60, 8, true, false),
  (5, 'Apple Watch Series 9', 'smartwatch', 3299, 3799, 13, 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400', 'Relogio inteligente com monitoramento', 20, 9, true, false),
  (6, 'Teclado Mecanico', 'accessories', 499, null, null, 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400', 'Teclado mecanico RGB para gamers', 70, 18, true, true),
  (7, 'Sony WH-1000XM5', 'headphones', 2499, 2999, 17, 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400', 'Fone com cancelamento de ruido', 45, 4, true, false),
  (8, 'Dell XPS 13', 'laptops', 7999, null, null, 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=400', 'Notebook Windows premium', 10, 7, true, false)
on conflict (id) do update set
  nome = excluded.nome,
  categoria = excluded.categoria,
  preco = excluded.preco,
  preco_original = excluded.preco_original,
  desconto = excluded.desconto,
  imagem = excluded.imagem,
  descricao = excluded.descricao,
  popularity_score = excluded.popularity_score,
  stock = excluded.stock,
  is_active = excluded.is_active,
  is_featured = excluded.is_featured;
