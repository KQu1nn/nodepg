const TelegramBot = require('node-telegram-bot-api');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Substitua pelo seu token do bot do Telegram
const token = '7864508088:AAH6flKzsprF2TBpdYa3GeuxruTTygrMNpY';

// Adicione o seu ID de usuário do Telegram
const ADMIN_CHAT_ID = '7112526171';  // Substitua pelo seu ID do Telegram

// Cria uma instância do bot do Telegram
const bot = new TelegramBot(token, { polling: true });

// Lista de valores a serem verificados
const TARGET_VALUES = [
    "R$ 15", "R$ 15,00", "15,00", "15",
    "R$ 20", "R$ 20,00", "20,00", "20",
    "R$ 30", "R$ 30,00", "30,00", "30",
    "R$ 35", "R$ 35,00", "35,00", "35",
    "9,99", "R$ 9,99", "10,00", "R$ 10,00", "10",
    "14,99", "R$ 14,99", "19,99", "R$ 19,99",
    "29,99", "R$ 29,99", "34,99", "R$ 34,99"
];

const TARGET_NAME = "Ramon";

// Função para baixar arquivos enviados no Telegram
const downloadFile = async (fileId, dest) => {
    const fileLink = await bot.getFileLink(fileId);
    const response = await axios({
        url: fileLink,
        responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
        const filePath = path.resolve(dest);
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
    });
};

// Função para processar imagens com OCR
async function processImage(filePath) {
    return Tesseract.recognize(filePath, 'eng', { logger: m => console.log(m) })
        .then(({ data: { text } }) => text);
}

// Função para processar PDFs
async function processPDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    return pdfParse(dataBuffer).then(data => data.text);
}

// Função para verificar se o texto contém o valor e o nome desejados
function verifyText(text) {
    return TARGET_VALUES.some(value => text.includes(value)) && text.includes(TARGET_NAME);
}

// Função para simular delay
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para enviar logs para o administrador
async function sendAdminLog(msg, fileLink) {
    const logMessage = `
        📄 *Novo Comprovante Recebido*
        👤 *Usuário:* ${msg.from.first_name} ${msg.from.last_name || ''}
        🆔 *ID:* ${msg.from.id}
        ⏰ *Hora:* ${new Date().toLocaleString()}
        📎 *Arquivo:* [Ver Comprovante](${fileLink})
    `;
    await bot.sendMessage(ADMIN_CHAT_ID, logMessage, { parse_mode: 'Markdown' });
}

// Manipula a mensagem de documentos ou imagens
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    // Verifica se a mensagem contém um documento ou foto
    if (msg.document || msg.photo) {
        let fileId;
        let fileName;

        // Se for uma imagem, pegamos a maior resolução da foto
        if (msg.photo) {
            const photos = msg.photo;
            fileId = photos[photos.length - 1].file_id; // Pega a melhor resolução
            fileName = 'image.jpg';
        } else if (msg.document) {
            fileId = msg.document.file_id;
            fileName = msg.document.file_name;
        }

        // Define o caminho temporário para salvar o arquivo
        const filePath = path.join(__dirname, fileName);

        try {
            // Baixa o arquivo do Telegram
            await downloadFile(fileId, filePath);

            let extractedText = '';
            const fileExt = path.extname(filePath).toLowerCase();

            if (fileExt === '.pdf') {
                extractedText = await processPDF(filePath);
            } else if (['.png', '.jpg', '.jpeg'].includes(fileExt)) {
                extractedText = await processImage(filePath);
            } else {
                bot.sendMessage(chatId, 'Formato de arquivo não suportado.');
                return;
            }

            // Exibe a mensagem de análise antes de qualquer verificação
            await bot.sendMessage(chatId, '🔍 Analisando seu comprovante...');
            await sleep(7000);  // Espera 7 segundos

            // Verifica se o conteúdo corresponde
            if (verifyText(extractedText)) {
                await bot.sendMessage(chatId, '✅ Comprovante verificado com sucesso!');
                await bot.sendMessage(chatId, 'Você agora tem acesso ao grupo VIP! 🎉');
                await sleep(5000);  // Espera mais 5 segundos
                await bot.sendMessage(chatId, 
                    `CANAL VIP: https://t.me/+6AmjfLJPTxFhNzUx\n` +
                    `CANAL VIP BONUS: https://t.me/VazaNudes18\n` +
                    `CANAL VIP BONUS: t.me/+mCImondNtWYzZmI5`
                );
            } else {
                await bot.sendMessage(chatId, 'Comprovante Inválido, verifique se o valor ou destinatário estão corretos. Se você acredita que cometemos um erro, contate um Suporte: @agenciameladinhasvip');
            }

            // Envia um log para o administrador
            const fileLink = await bot.getFileLink(fileId);
            await sendAdminLog(msg, fileLink);

        } catch (error) {
            console.error(error);
            bot.sendMessage(chatId, 'Erro ao processar o arquivo.');
        } finally {
            // Remove o arquivo após o processamento
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    } 
    // Se não for imagem ou PDF, não faz nada
});

console.log('Bot está rodando...');
