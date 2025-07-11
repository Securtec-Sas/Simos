document.addEventListener('DOMContentLoaded', () => {
    const exchangeListDiv = document.getElementById('exchangeList');
    const refreshButton = document.getElementById('refreshButton');
    const loadingDiv = document.getElementById('loading');

    const fetchExchangeStatus = async () => {
        exchangeListDiv.innerHTML = ''; // Limpiar lista anterior
        loadingDiv.style.display = 'block'; // Mostrar spinner de carga

        try {
            const response = await fetch('http://localhost:3000/api/exchanges-status');
            const data = await response.json();
            loadingDiv.style.display = 'none'; // Ocultar spinner

            if (data.length === 0) {
                exchangeListDiv.innerHTML = '<p>No se encontraron exchanges o hubo un problema al cargar.</p>';
                return;
            }

            data.forEach(ex => {
                const exchangeItem = document.createElement('div');
                exchangeItem.classList.add('exchange-item');

                const statusDotClass = ex.connected ? 'status-dot-green' : 'status-dot-red';
                const buttonText = ex.connected ? 'Conectado' : 'Fallo';
                const priceText = ex.priceXRPUSDT !== 'N/A' && ex.priceXRPUSDT !== 'Pair not available'
                                  ? `Precio XRP/USDT: $ ${ex.priceXRPUSDT}`
                                  : ex.priceXRPUSDT === 'Pair not available'
                                    ? 'Par no disponible'
                                    : 'Precio N/A';

                exchangeItem.innerHTML = ;
                exchangeListDiv.appendChild(exchangeItem);
            });
        } catch (error) {
            console.error('Error al obtener el estado de los exchanges:', error);
            loadingDiv.style.display = 'none';
            exchangeListDiv.innerHTML = '<p>Error al cargar la información. Inténtalo de nuevo más tarde.</p>';
        }
    };

    refreshButton.addEventListener('click', fetchExchangeStatus);

    // Cargar el estado al iniciar
    fetchExchangeStatus();
});
