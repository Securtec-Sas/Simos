import React from 'react';
import Sidebar from '../Sidebar/Sidebar.jsx';
import BalanceDisplay from '../BalanceDisplay/BalanceDisplay.jsx'; // Import BalanceDisplay
import { Outlet } from 'react-router-dom';
import layoutStyles from './Layout.module.css'; // Create a new CSS module for layout specific styles
import appStyles from '../../App.module.css'; // Keep appStyles for general layout if needed

const Layout = ({ allExchanges, setAllExchanges, lastBalanceInfo }) => (
  <div className={appStyles.layout}> {/* Or layoutStyles.layout if appStyles is too general */}
    <Sidebar allExchanges={allExchanges} setAllExchanges={setAllExchanges} />
    <main className={appStyles.main}> {/* Or layoutStyles.mainContent */}
      <div className={layoutStyles.mainHeader}>
        {/* Other header content could go here */}
        <div className={layoutStyles.balanceDisplayWrapper}>
          <BalanceDisplay balanceInfo={lastBalanceInfo} />
        </div>
      </div>
      <div className={layoutStyles.pageContent}>
        <Outlet />
      </div>
    </main>
  </div>
);

export default Layout;