import { defineField, defineType } from "sanity";

export const haberType = defineType({
  name: "haber",
  title: "Haber",
  type: "document",
  fields: [
    defineField({
      name: "baslik",
      title: "Başlık",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Haber adresi (slug)",
      description: "Başlığın yanındaki Generate butonuna bas, otomatik oluşur.",
      type: "slug",
      options: { source: "baslik", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "spot",
      title: "Spot (kısa özet)",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "kategori",
      title: "Kategori",
      type: "string",
      options: {
        list: [
          { title: "Borsa", value: "borsa" },
          { title: "Döviz", value: "doviz" },
          { title: "Emtia", value: "emtia" },
          { title: "Ekonomi", value: "ekonomi" },
          { title: "Kripto", value: "kripto" },
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "kapakGorseli",
      title: "Kapak görseli",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "icerik",
      title: "Haber metni",
      type: "array",
      of: [{ type: "block" }, { type: "image" }],
    }),
    defineField({
      name: "kaynak",
      title: "Kaynak",
      type: "string",
    }),
    defineField({
      name: "yayinTarihi",
      title: "Yayın tarihi",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
    }),
  ],
  preview: {
    select: { title: "baslik", subtitle: "kategori", media: "kapakGorseli" },
  },
});