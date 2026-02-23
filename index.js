const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const CATEGORY_ID = "1465965687565455474";
const STAFF_ROLE_ID = "1463087905156366336";
const CLAIM_CHANNEL_ID = "1475207708910161991";
const IMAGE_URL = "https://tenor.com/view/hatsune-miku-miku-ew-what-disgusted-gif-15627475628353335525";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// إرسال القائمة + الصورة فقط
client.on("messageCreate", async (message) => {
  if (message.content === "!ticket") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("اختر السبب")
      .addOptions([
        { label: "استفسار", value: "استفسار" },
        { label: "مشكلة", value: "مشكلة" },
        { label: "اقتراح", value: "اقتراح" },
        { label: "شكوى", value: "شكوى" }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await message.channel.send({
      content: IMAGE_URL,
      components: [row]
    });
  }
});

// التفاعلات
client.on("interactionCreate", async (interaction) => {

  // اختيار سبب التكت
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
    const reason = interaction.values[0];

    // إنشاء التكت مخفي عن الجميع
    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.id}`,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    // زر الاستلام في روم الاستلام
    const claimChannel = interaction.guild.channels.cache.get(CLAIM_CHANNEL_ID);
    const claimRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`claim_${channel.id}_${interaction.user.id}_${reason}`)
        .setLabel("استلام التكت")
        .setStyle(ButtonStyle.Secondary)
    );

    await claimChannel.send({
      content: `new ticket\nالعضو: ${interaction.user}\nالسبب: ${reason}\nالمستلم: لم يتم الاستلام بعد`,
      components: [claimRow]
    });

    interaction.reply({ content: "...w", ephemeral: true });
  }

  // زر الاستلام
  if (interaction.isButton() && interaction.customId.startsWith("claim_")) {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.reply({ content: "للإدارة فقط", ephemeral: true });

    const [_, channelId, userId, reason] = interaction.customId.split("_");
    const ticketChannel = interaction.guild.channels.cache.get(channelId);
    const ticketUser = await interaction.guild.members.fetch(userId);

    if (!ticketChannel) return interaction.reply({ content: "التذكرة غير موجودة", ephemeral: true });

    // اعطاء العضو والإداري صلاحية الدخول
    await ticketChannel.permissionOverwrites.edit(ticketUser.id, {
      ViewChannel: true,
      SendMessages: true
    });

    await ticketChannel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true
    });

    // تعديل رسالة الاستلام لتظهر اسم الاداري
    const updatedContent = interaction.message.content.replace("لم يتم الاستلام بعد", `${interaction.user}`);

    const disabledRow = new ActionRowBuilder().addComponents(
      ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true)
    );

    await interaction.update({ content: updatedContent, components: [disabledRow] });

    // ارسال رسالة في التكت مع أزرار شفافه
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_ticket").setLabel("اغلاق التكت").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("delete_ticket").setLabel("حذف التكت").setStyle(ButtonStyle.Secondary)
    );

    await ticketChannel.send({
      content: ` ${ticketUser} ${interaction.user}\nالسبب: ${reason}`,
      components: [actionRow]
    });
  }

  // زر الإغلاق
  if (interaction.isButton() && interaction.customId === "close_ticket") {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.reply({ content: "للإدارة فقط", ephemeral: true });

    await interaction.reply({ content: "تم إغلاق التكت", ephemeral: true });
  }

  // زر الحذف
  if (interaction.isButton() && interaction.customId === "delete_ticket") {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.reply({ content: "للإدارة فقط", ephemeral: true });

    await interaction.reply({ content: "جارٍ حذف التكت...", ephemeral: true });
    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 2000);
  }

});

client.login(process.env.TOKEN);
