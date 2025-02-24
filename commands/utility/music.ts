import { SlashCommandBuilder } from "@discordjs/builders";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { ExtendedClient } from "../../index";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("music")
        .setDescription("音楽コマンド")
        .addSubcommand(subcommand =>
            subcommand
                .setName("play")
                .setDescription("音楽を再生します")
                .addStringOption(option =>
                    option
                        .setName("query")
                        .setDescription("曲の名前またはURLを指定してください。")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("volume")
                .setDescription("音量を設定します")
                .addNumberOption(option =>
                    option
                        .setName("percentage")
                        .setDescription("音量をパーセンテージで指定してください。: 10 = 10%")
                        .setMinValue(0)
                        .setMaxValue(100)
                        .setRequired(true)
                )
            )
            .addSubcommand(subcommand =>
            subcommand
                .setName("options")
                .setDescription("音楽のオプションを設定します")
                .addStringOption(option =>
                    option
                        .setName("option")
                        .setDescription("オプションを選択してください")
                        .setRequired(true)
                        .addChoices(
                            { name: "スキップ", value: "skip" },
                            { name: "停止", value: "stop" },
                            { name: "一時停止", value: "pause" },
                            { name: "再開", value: "resume" },
                            { name: "キュー", value: "queue" },
                            { name: "ループトラック", value: "loopqueue" },
                            { name: "ループ", value: "loopall" },
                            { name: "自動再生", value: "autoplay" },
                            { name: "シャッフル", value: "shuffle" },
                            { name: "フィルタ", value: "filter" }
                        )
                    )
                ),
    async execute(interaction: any) {
        // 既に応答済みかチェックしてから deferReply を呼ぶ
        if (!interaction.deferred && !interaction.replied) {
            try {
                await interaction.deferReply();
            } catch (e: any) {
                // エラーコード 10062 または 40060 ("Interaction has already been acknowledged")
                if (e.code === 10062 || e.code === 40060) {
                    console.warn("Interaction already acknowledged; proceeding.");
                } else {
                    throw e;
                }
            }
        }

        const { options, member, guild } = interaction;
        const subcommand = options.getSubcommand();
        const query = options.getString("query");
        const volume = options.getNumber("percentage");
        const option = options.getString("option");
        const voiceChannel = member.voice.channel;
        const client = interaction.client as ExtendedClient;
        const embed = new EmbedBuilder();
        
        if (!voiceChannel) {
            embed.setColor("Red").setDescription("ボイスチャンネルに参加してください。");
            return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        if (!voiceChannel.joinable) {
            embed.setColor("Red").setDescription("このボイスチャンネルには接続できません。");
            return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        if (guild.members.me.voice.channelId && guild.members.me.voice.channelId !== member.voice.channelId) {
            embed.setColor("Red").setDescription(`音楽システムは既に<#${guild.members.me.voice.channelId}>でアクティブです。`);
            return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        
        try {
            switch (subcommand) {
                case "play": {
                    try {
                        await client.distube.play(voiceChannel, query, { textChannel: interaction.channel, member });
                        return interaction.followUp({ content: 'リクエストはキューに追加されました。' });
                    } catch (error) {
                        console.error(error);
                        embed.setColor("Red").setDescription("曲再生中に接続エラーが発生しました。");
                        return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                }
                case "volume": {
                    // ギルドごとのキューを取得
                    const queue = client.distube.getQueue(guild);
                    if (!queue) {
                        embed.setColor("Red").setDescription("キューは既に空です。");
                        return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                    client.distube.setVolume(voiceChannel, volume);
                    return interaction.followUp({ content: `音量を${volume}%に設定しました。` });
                }
                case "options": {
                    // ギルドごとのキューを取得
                    const queue = client.distube.getQueue(guild);
                    if (!queue) {
                        embed.setColor("Red").setDescription("キューは既に空です。");
                        return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    }
                    // オプション処理はそのままでOK
                    switch (option) {
                        case "skip": {
                            await queue.skip();
                            embed.setColor("Blue").setDescription("⏭️ **トラックがスキップされました**");
                            return interaction.followUp({ embeds: [embed] });
                        }
                        case "stop": {
                            await queue.stop();
                            embed.setColor("Blue").setDescription("⏹️ **トラックが停止されました**");
                            return interaction.followUp({ embeds: [embed] });
                        }
                        case "resume": {
                            await queue.resume();
                            embed.setColor("Blue").setDescription("▶️ **トラックが再開されました**");
                            return interaction.followUp({ embeds: [embed] });
                        }
                        case "queue": {
                            embed.setColor("Blue").setDescription(`キュー: ${queue.songs.map((song, id) => `**${id + 1}**. [${song.name}](${song.url}) - \`${song.formattedDuration}\``).join("\n")}`);
                            return interaction.followUp({ embeds: [embed] });
                        }
                        case "loopqueue": {
                            if (queue.repeatMode === 2) {
                                client.distube.setRepeatMode(interaction, 0);
                                embed.setColor("Blue").setDescription(`🔂 **トラックはループされていません:** \`キュー\``);
                            } else {
                                client.distube.setRepeatMode(interaction, 2);
                                embed.setColor("Blue").setDescription(`🔂 **トラックはループされています:** \`キュー\``);
                            }
                            return interaction.followUp({ embeds: [embed] });
                        }
                        case "loopall": {
                            if (queue.repeatMode === 0) {
                                client.distube.setRepeatMode(interaction, 1);
                                embed.setColor("Blue").setDescription(`🔁 **トラックはループされています:** \`全て\``);
                            } else {
                                client.distube.setRepeatMode(interaction, 0);
                                embed.setColor("Blue").setDescription(`🔁 **トラックはループされていません:** \`全て\``);
                            }
                            return interaction.followUp({ embeds: [embed] });
                        }
                        case "autoplay": {
                            if (!queue.autoplay) {
                                client.distube.toggleAutoplay(interaction);
                                embed.setColor("Blue").setDescription(`🔀 **自動再生が有効になりました**`);
                            } else {
                                client.distube.toggleAutoplay(interaction);
                                embed.setColor("Blue").setDescription(`🔀 **自動再生が無効になりました**`);
                            }
                            return interaction.followUp({ embeds: [embed] });
                        }
                        case "shuffle": {
                            await client.distube.shuffle(voiceChannel);
                            embed.setColor("Blue").setDescription(`🔀 **キューはシャッフルされました**`);
                            return interaction.followUp({ embeds: [embed] });
                        }
                        case "filter": {
                            const filters = queue.filters.names;
                            if (filters && filters.length > 0) {
                                embed.setColor("Blue").setDescription(`フィルター: ${filters.join(", ")}`);
                            } else {
                                embed.setColor("Red").setDescription("フィルターが見つかりません。");
                                return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                            }
                            return interaction.followUp({ embeds: [embed] });
                        }
                        default: {
                            embed.setColor("Red").setDescription("無効なオプションです。");
                            return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                        }
                    }
                }
                default: {
                    embed.setColor("Red").setDescription("無効なサブコマンドです。");
                    return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
                }
            }
        } catch (error) {
            console.error(error);
            embed.setColor("Red").setDescription("エラーが発生しました。");
            return interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
};