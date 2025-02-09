const { SERVER } = require('dotenv').config();
const { chromium } = require('playwright');
const axios = require('axios');
const PORT = process.env.PORT || 3000;
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'consulta_errors.log'); // Define la ruta del archivo de log

// Función para escribir en el log
function logError(message) {
    const date = new Date().toISOString();
    const logMessage = `[${date}] ${message}\n`;
    fs.appendFile(logFile, logMessage, (err) => {
        if (err) {
            console.error('Error al escribir en el archivo de log:', err);
        }
    });
}

(async () => {
    const express = require('express');
    const app = express();

    const beneficiariesHeaders = ["ID del hogar", "Tipo de documento de identificación", "Documento de identificación", "Nombres y apellidos", "Entidad", "Fecha de postulación", "Clasificación de Sisbén IV*"];
    const resolutionHeaders = ["Resolución de asignación", "Fecha de Pago del subsidio"];
    const complementarySubsidyHeaders = ["Entidad Otorgante", "Acto Administrativo", "Estado"];
    const complementarySubsidyHeaders2 = ["Entidad Otorgante", "Estado"];


    app.get('/', (req, res) => {
        res.send('Aplicación de scraping en ejecución');
    });

    app.listen(PORT, () => {
        console.log(`App running on port ${PORT}`);
    });

    // Funciones de formateo de datos
    function FormData1(fecha) {
        const dateParts = fecha.split(": ")[1].split("/");
        const date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        return date;
    }

    function FormData2(fecha) {
        if (!fecha || fecha.trim() === '') {
            return '';
        }
        const dateParts = fecha.split("/");
        const date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        return date;
    }

    // Función para extraer datos de tablas
    const extractTableData = async (page) => {
        return await page.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('.table'));
            return tables.map(table => {
                const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
                const rows = Array.from(table.querySelectorAll('tr')).map(row => {
                    const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
                    return cells;
                });
                return { headers, rows };
            });
        });
    };

    // Función para obtener cédulas
    async function obtenerCedulas() {
        const response = await axios.get('', { // URL de la API
            headers: { 'key': process.env.SECRET_KEY }
        });

        return response.data.data.map(item => ({
            identification: item.identification,
            crmId: item.crmId
        }));
    }

    // Función para obtener cédulas
    async function obtenerCedulasV2() {
        const response = await axios.get('', { // URL de la API
            headers: { 'key': process.env.SECRET_KEY }
        });

        return response.data.data.map(item => ({
            identification: item.identification,
            crmId: item.crmId
        }));
    }

    // Función para enviar datos a la API
    async function enviarDatosAPI(crmId, transformedData) {
        try {
            await axios.patch(``, transformedData, { // URL de la API
                headers: {
                    'Content-Type': 'application/json',
                    'key': process.env.SECRET_KEY
                }
            })
            .then(response => {
                console.log(response.data);  
            });
        } catch (error) {
            logError("Error al enviar los datos:", error);
        }
    }

    // Función para procesar una cédula
    async function procesarCedula(page, identification, crmId) {
        await page.goto('https://subsidiosfonvivienda.minvivienda.gov.co/micasaya/');
        await page.waitForSelector('.btn-buscar');
        await page.selectOption('#cbTipoIdentificacion', { value: '1' });
        await page.fill('#txtIdentificacion', identification);
        await page.click('.btn-buscar');

        try {
            await page.waitForSelector('.table', { timeout: 15000 });
        } catch (e) {
            // Si no hay tabla, significa que no hay registros
            const transformedData = {
                id_res: crmId,
                state: 'No se encontraron registros',
                beneficiaries: [],
                resolution: { resolutionNumber: "", dateResolution: null, dateSubsidyPayment: null },
                complementarySubsidy: { complementaryEntityName: "", complementaryResolution: "", complementaryFecha: null, complementaryState: "" }
            };
            await enviarDatosAPI(crmId, transformedData);
            return;
        }

        const state = await page.evaluate(() => {
            return document.querySelector('.card-header .text-important')?.innerText.trim() || '';
        });

        const tableData = await extractTableData(page);

        // Procesar datos y transformarlos en el formato esperado
        let transformedData = transformarDatos(tableData, identification, crmId, state);

        await enviarDatosAPI(crmId, transformedData);
    }

    // Función para transformar los datos extraídos en el formato esperado
    function transformarDatos(tableData, identification, crmId, state) {
        let beneficiariesData = [];
        let resolutionData = [];
        let complementarySubsidyData = [];
        let complementarySubsidyData2 = [];

        tableData.forEach(({ headers, rows }) => {
            if (headers.every((header, index) => beneficiariesHeaders[index] === header)) {
                beneficiariesData = rows.filter(row => row[2] === identification);
            } else if (headers.every((header, index) => resolutionHeaders[index] === header)) {
                resolutionData = rows;
            } else if (headers.every((header, index) => complementarySubsidyHeaders[index] === header )) {
                complementarySubsidyData = rows;
            } else if (headers.every((header, index) => complementarySubsidyHeaders2[index] === header )) {
                complementarySubsidyData2 = rows;
            }

        });

        let numRes, sentenceArray, fechaRes, fechaPag;
        if (beneficiariesData.length > 0) {
            idHogar = beneficiariesData[0]?.[0];
            tipoIdentificacion = beneficiariesData[0]?.[1];
            numIdentificacion = beneficiariesData[0]?.[2];
            nombPersona = beneficiariesData[0]?.[3];
            entidCred = beneficiariesData[0]?.[4];
            fechPostul = FormData2(beneficiariesData[0]?.[5]);
            clasiSisben = beneficiariesData[0]?.[6];
        }

        if (resolutionData?.length > 0) {
            let sentence = resolutionData[1].toString();
            sentenceArray = sentence.split('/n');
            let numResolt = resolutionData[1].toString();
            let numResoltArray = numResolt.split(' ');
            numRes = numResoltArray[0];

            let fecResolt = resolutionData[1].toString();
            let fecResoltArray = fecResolt.split(' ');
            fechaRes = FormData2(fecResoltArray[4].replace(")", "").replace("Consulte", "").trim());

            let fecResoltPag = resolutionData[1].toString();
            let fecResoltArrayPag = fecResoltPag.split(' ');
            fechaPag = FormData2(fecResoltArrayPag[12].replace("AQUÍ,", "").replace("AQUÍ", "").trim());
        }

        let dataComple, NombEntid, numResoltC, dateMatch, FechaCompl, EstadoComp;
        if (complementarySubsidyData?.length > 0) {
            dataComple = complementarySubsidyData[1].toString();
            dataComple = dataComple.split(',');

            NombEntid = dataComple[0];
            numResoltC = dataComple[1].match(/\d+-\d+/)[0];
            dateMatch = dataComple[1].match(/\(([^)]+)\)/)[1];
            FechaCompl = FormData1(dateMatch);
            EstadoComp = dataComple[2];
        } else if (complementarySubsidyData2?.length > 0) {
            dataComple = complementarySubsidyData2[1].toString();
            dataComple = dataComple.split(',');

            NombEntid = dataComple[0];
            EstadoComp = dataComple[1];
        }
        return {
            id_res: crmId,
            state: state,
            beneficiaries: beneficiariesData.length > 0 ? [
                {
                    id: idHogar || "",
                    identificationType: tipoIdentificacion || "",
                    identification: numIdentificacion || "",
                    names: nombPersona || "",
                    creditEntity: entidCred || "",
                    datePostulation: fechPostul || null,
                    sisbenClasification: clasiSisben || ""
                }
            ] : [],
            resolution: resolutionData.length > 0 ? {
                resolutionNumber: numRes || "",
                dateResolution: fechaRes || null,
                dateSubsidyPayment: fechaPag || null
            } : { resolutionNumber: "", dateResolution: null, dateSubsidyPayment: null },
            complementarySubsidy: complementarySubsidyData.length > 0 ? {
                complementaryEntityName: NombEntid || "",
                complementaryResolution: numResoltC || "",
                complementaryFecha: FechaCompl || null,
                complementaryState: EstadoComp || "",
            } : complementarySubsidyData2.length > 0 ? {
                complementaryEntityName: NombEntid || "",
                complementaryState: EstadoComp || ""
            } : { complementaryEntityName: "", complementaryResolution: "", complementaryFecha: null, complementaryState: "" }
        };
    }

    // Configuración de Playwright y ejecución principal
    async function ejecutarScraping() {
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ timeout: 60000 });
        const cedulasYIds = await obtenerCedulas();

        const errors = [];
        let contador = 0;

        console.log("===============================================================");
        console.log("Iniciamos el proceso");
        console.log("===============================================================");

        // Iterar sobre cada cédula y extraer la información
        for (const { identification, crmId } of cedulasYIds) {
            const page = await context.newPage();
            contador++;

            try {
                await procesarCedula(page, identification, crmId);
            } catch (error) {
                errors.push({ identification, error: error.message });
            } finally {
                await page.close();
            }

            console.log(`Procesado ${contador}/${cedulasYIds.length}`);
            console.log("===============================================================");
        }

        await browser.close();
        if (errors.length > 0) {
            logError('Errores encontrados:', errors);
        }
        console.log(`Total de cédulas procesadas: ${cedulasYIds.length}`);
    }

    async function ejecutarScrapingV2() {
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ timeout: 60000 });
        const cedulasYIds = await obtenerCedulasV2();

        const errors = [];
        let contador = 0;

        console.log("===============================================================");
        console.log("Iniciamos el proceso");
        console.log("===============================================================");

        // Iterar sobre cada cédula y extraer la información
        for (const { identification, crmId } of cedulasYIds) {
            const page = await context.newPage();
            contador++;

            try {
                await procesarCedula(page, identification, crmId);
            } catch (error) {
                errors.push({ identification, error: error.message });
            } finally {
                await page.close();
            }

            console.log(`Procesado ${contador}/${cedulasYIds.length}`);
            console.log("===============================================================");
        }

        await browser.close();
        if (errors.length > 0) {
            logError('Errores encontrados:', errors);
        }
        console.log(`Total de cédulas procesadas: ${cedulasYIds.length}`);
    }


    // Iniciar el proceso de scraping
    await ejecutarScraping();
    console.log("===============================================================");
    console.log("Segunda Verificacion de clientes en las plataformas");
    console.log("===============================================================");

    await ejecutarScrapingV2();

    console.log("Proceso de scraping completado.");
    process.exit(0);

})();
