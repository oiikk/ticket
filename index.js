const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
  AttachmentBuilder
} = require("discord.js");

const { createCanvas, loadImage, registerFont } = require("canvas");
const path = require("path");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== إعدادات التكت =====
const CATEGORY_ID = "1465965687565455474";
const STAFF_ROLE_ID = "1463087905156366336";
const CLAIM_CHANNEL_ID = "1475207708910161991";
const TRANSCRIPT_CHANNEL_ID = "1476273815502983189";
const IMAGE_URL = "https://tenor.com/view/hatsune-miku-miku-ew-what-disgusted-gif-15627475628353335525";

// ===== تسجيل الخط العربي =====
registerFont(path.join(__dirname, 'fonts/Cairo-VariableFont_slnt,wght.ttf'), { family: 'Cairo' });

// ===== حالة البوت ستريمنج =====
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: " ", type: 1, url: "https://www.twitch.tv/discord" }],
    status: "dnd"
  });
});

// ===== إرسال قائمة التكت =====
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

// ===== التعامل مع التفاعلات =====
client.on("interactionCreate", async (interaction) => {
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
    await interaction.deferReply({ ephemeral: true });
    const reason = interaction.values[0];

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.id}`,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    const claimRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`claim_${channel.id}_${interaction.user.id}_${reason}`)
        .setLabel("استلام التكت")
        .setStyle(ButtonStyle.Secondary)
    );

    const claimChannel = interaction.guild.channels.cache.get(CLAIM_CHANNEL_ID);
    await claimChannel.send({
      content: `\nالعضو: ${interaction.user}\nالسبب: ${reason}\nالمستلم: لم يتم الاستلام بعد`,
      components: [claimRow]
    });

    await interaction.editReply({ content: "تم إنشاء التكت" });
  }

  if (interaction.isButton() && interaction.customId.startsWith("claim_")) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.editReply({ content: "للإدارة فقط" });

    const [_, channelId, userId, reason] = interaction.customId.split("_");
    const ticketChannel = interaction.guild.channels.cache.get(channelId);
    const ticketUser = await interaction.guild.members.fetch(userId);

    if (!ticketChannel)
      return interaction.editReply({ content: "التذكرة غير موجودة" });

    await ticketChannel.permissionOverwrites.edit(ticketUser.id, {
      ViewChannel: true,
      SendMessages: true
    });

    await ticketChannel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true
    });

    const updatedContent = interaction.message.content.replace(
      "لم يتم الاستلام بعد",
      `${interaction.user}`
    );

    const disabledRow = new ActionRowBuilder().addComponents(
      ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true)
    );

    await interaction.message.edit({ content: updatedContent, components: [disabledRow] });

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_ticket").setLabel("اغلاق التكت").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("delete_ticket").setLabel("حذف التكت").setStyle(ButtonStyle.Secondary)
    );

    await ticketChannel.send({
      content: `${ticketUser} ${interaction.user}\nالسبب: ${reason}`,
      components: [actionRow]
    });

    await interaction.editReply({ content: "تم استلام التكت" });
  }

  if (interaction.isButton() && interaction.customId === "close_ticket") {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.editReply({ content: "للإدارة فقط" });

    await interaction.channel.send("🔒 تم إغلاق التكت");
    await interaction.editReply({ content: "تم إغلاق التكت" });
  }

  if (interaction.isButton() && interaction.customId === "delete_ticket") {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.editReply({ content: "للإدارة فقط" });

    const channel = interaction.channel;
    let messages = [];
    let lastId;

    while (true) {
      const fetched = await channel.messages.fetch({ limit: 100, before: lastId });
      if (fetched.size === 0) break;

      messages.push(...fetched.values());
      lastId = fetched.last().id;
    }

    messages = messages.reverse();

    // ===== إنشاء الصورة مع صور دائرية =====
    const width = 800;
    const lineHeight = 60;
    const padding = 20;
    const height = messages.length * lineHeight + padding * 2 + 60;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#2b2d31";
    ctx.fillRect(0, 0, width, height);

    ctx.font = '20px "Cairo"';
    ctx.fillStyle = "#ffffff";

    let y = padding + 40;
    for (const msg of messages) {
      // صورة المستخدم
      try {
        const avatar = await loadImage(msg.author.displayAvatarURL({ extension: "png", size: 64 }));
        const radius = 25;
        const x = padding + radius;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y - 10 + radius, radius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, padding, y - 10, radius * 2, radius * 2);
        ctx.restore();
      } catch (e) {
        console.log("خطأ في تحميل صورة العضو:", e.message);
      }

      // نص الرسالة
      ctx.fillText(`[${msg.author.username}]: ${msg.content}`, padding + 60, y + 15);
      y += lineHeight;
    }

    const buffer = canvas.toBuffer("image/png");
    const attachment = new AttachmentBuilder(buffer, { name: `${channel.name}-transcript.png` });

    const transcriptChannel = interaction.guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID);
    if (transcriptChannel) {
      await transcriptChannel.send({ files: [attachment] });
    }

    await interaction.editReply({ content: "زوططططططط..." });

    setTimeout(() => {
      channel.delete().catch(() => {});
    }, 3000);
  }
});

client.login(process.env.TOKEN);
