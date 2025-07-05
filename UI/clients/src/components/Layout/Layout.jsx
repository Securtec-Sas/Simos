// UI/clients/src/components/Layout/Layout.jsx

import React from 'react';
// import Sidebar from '../Sidebar/Sidebar.jsx'; // Reemplazado por Navigation
import Navigation from '../../../Navigation.jsx'; // Importar Navigation
import { Outlet } from 'react-router-dom';
import styles from '../../App.module.css'; // Considerar si estos estilos aún son necesarios o si Navigation maneja el layout

const Layout = ({ allExchanges, setAllExchanges }) => (
  // La clase styles.layout podría necesitar ajustes si Navigation.jsx tiene su propia estructura
  // Por ahora, la mantenemos para la estructura general de main content
  <div>
    <Navigation /> {/* Usar Navigation en lugar de Sidebar */}
    {/* El prop allExchanges y setAllExchanges no parece ser usado por Navigation, así que lo quitamos de aquí */}
    {/* Si Navigation necesitara esos props, habría que pasarlos */}
    <main className={styles.main}> {/* Asegurar que esta clase no entre en conflicto con Navigation */}
      <Outlet />
    </main>
  </div>
);

export default Layout;
