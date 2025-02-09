# Web-Scraping

Plataforma para realizar consultas a páginas de subsidios gubernamentales.

## Requisitos

Asegúrate de tener instalados los siguientes paquetes en tu sistema:

- Node.js
- npm (Node Package Manager)

Además, asegúrate de tener instaladas las siguientes librerías del sistema, que están listadas en el archivo `Aptfile`:


## Instalación

1. Clona el repositorio en tu máquina local.
2. Navega al directorio del proyecto.
3. Instala las dependencias del proyecto ejecutando:

    ```sh
    npm install
    ```

4. Crea un archivo [.env](http://_vscodecontentref_/1) en la raíz del proyecto con el siguiente contenido:

    ```env
    SECRET_KEY="Your secret key"
    PORT=3000
    ```

## Uso

Para iniciar la aplicación, ejecuta el siguiente comando:

```sh
npm start


Ejecución en Producción
Para ejecutar la aplicación en un entorno de producción, puedes utilizar el archivo Procfile con un gestor de procesos como foreman o heroku.
web: node index.js
web: npx playwright install && node index.js

