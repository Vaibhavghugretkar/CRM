import React from 'react'
import Settings from './Widgets/settings'
import Layout from './Shared/Layout'

const AdminSettings = () => {
  return (
      <Layout>
          {/* Widgets Section */}
          <div className="p-4">
              <Settings />

          </div>
      </Layout>
  )
}

export default AdminSettings