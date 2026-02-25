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
const TRANSCRIPT_CHANNEL_ID = "1476273815502983189";
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


// ارسال القائمة
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

  // ==========================
  // اختيار سبب التكت
  // ==========================
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {

    await interaction.deferReply({ ephemeral: true }); // تفكير

    const reason = interaction.values[0];

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.id}`,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    const claimChannel = interaction.guild.channels.cache.get(CLAIM_CHANNEL_ID);

    const claimRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`claim_${channel.id}_${interaction.user.id}_${reason}`)
        .setLabel("استلام التكت")
        .setStyle(ButtonStyle.Secondary)
    );

    await claimChannel.send({
      content: ` @here new ticket\nالعضو: ${interaction.user}\nالسبب: ${reason}\nالمستلم: لم يتم الاستلام بعد`,
      components: [claimRow]
    });

    await interaction.editReply({ content: "تم إنشاء التكت" });
  }


  // ==========================
  // استلام التكت
  // ==========================
  if (interaction.isButton() && interaction.customId.startsWith("claim_")) {

    await interaction.deferReply({ ephemeral: true }); // تفكير

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
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("اغلاق التكت")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("delete_ticket")
        .setLabel("حذف التكت")
        .setStyle(ButtonStyle.Secondary)
    );

    await ticketChannel.send({
      content: `${ticketUser} ${interaction.user}\nالسبب: ${reason}`,
      components: [actionRow]
    });

    await interaction.editReply({ content: "تم استلام التكت" });
  }


  // ==========================
  // اغلاق التكت
  // ==========================
  if (interaction.isButton() && interaction.customId === "close_ticket") {

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.editReply({ content: "للإدارة فقط" });

    await interaction.channel.send("🔒 تم إغلاق التكت");
    await interaction.editReply({ content: "تم إغلاق التكت" });
  }


  // ==========================
  // حذف التكت + حفظ الترانسكريبت
  // ==========================
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

    let transcript = `Transcript for ${channel.name}\n\n`;

    messages.forEach(msg => {
      transcript += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
    });

    const transcriptChannel = interaction.guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID);

    if (transcriptChannel) {
      await transcriptChannel.send({
        content: `: ${channel.name}`,
        files: [
          {
            attachment: Buffer.from(transcript, "utf-8"),
            name: `${channel.name}-transcript.txt`
          }
        ]
      });
    }

    await interaction.editReply({ content: " سيتم حذف التكت..." });

    setTimeout(() => {
      channel.delete().catch(() => {});
    }, 3000);
  }

});

client.login(process.env.TOKEN);
