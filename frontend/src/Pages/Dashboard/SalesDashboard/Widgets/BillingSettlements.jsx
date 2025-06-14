import { useEffect, useState, useRef } from "react";
import { FaDownload, FaSearch, FaPlus, FaEdit } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import axios from "axios";

const statusColors = {
  "Paid": "text-status-success",
  "Payment Received": "text-status-success",
  "Awaiting Payment": "text-status-warning",
  "Pending": "text-status-warning"
};

export default function BillingSettlements() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [searchInvoices, setSearchInvoices] = useState("");
  const [searchPayments, setSearchPayments] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(null);
  const [newInvoice, setNewInvoice] = useState({
    title: "",
    email: "",
    amount: "",
    issued: "",
    due: "",
    status: "Awaiting Payment"
  });
  const [editInvoice, setEditInvoice] = useState(null);

  // Add a ref for the amount input
  const amountInputRef = useRef(null);

  // Get today's date in YYYY-MM-DD format for date inputs
  const today = new Date().toISOString().split('T')[0];

  const [lastReminders, setLastReminders] = useState(() => {
    // Load from localStorage on initial render
    const stored = localStorage.getItem('lastReminders');
    return stored ? JSON.parse(stored) : {};
  });

  useEffect(() => {
    const fetchProposals = async () => {
      try {
        setLoadingProposals(true);
        const response = await axios.get("https://crm-r5rr.onrender.com/api/tech-proposals");
        const acceptedProposals = response.data.filter((proposal) => proposal.status === "Accepted" && proposal.adminApproval === true);
        setProposals(acceptedProposals);
      } catch (err) {
        console.error("Error fetching proposals:", err);
      } finally {
        setLoadingProposals(false);
      }
    };

    const fetchInvoices = async () => {
      try {
        setLoadingInvoices(true);
        const res = await axios.get("https://crm-r5rr.onrender.com/api/invoice");
        setInvoices(res.data);
      } catch (err) {
        console.error("Error fetching invoices:", err);
      } finally {
        setLoadingInvoices(false);
      }
    };

    const fetchPayments = async () => {
      try {
        const res = await axios.get("https://crm-r5rr.onrender.com/api/invoice"); // Add your actual endpoint here
        setPayments(res.data);
      } catch (err) {
        console.error("Error fetching payments:", err);
      }
    };

    fetchProposals();
    fetchInvoices();
    fetchPayments();  // Fetch payments data here
  }, []);

  useEffect(() => {
    // Keep lastReminders in sync with localStorage if invoices change (e.g., after refresh)
    const stored = localStorage.getItem('lastReminders');
    if (stored) {
      setLastReminders(JSON.parse(stored));
    }
  }, [invoices]);

  const handleSendReminder = async (id, invoice) => {
    const confirmed = window.confirm("Are you sure you want to send a reminder email?");
    if (!confirmed) return;

    try {
      setSendingReminder(id); // Set loading state for this specific invoice

      const response = await fetch("https://crm-r5rr.onrender.com/api/invoice/sendReminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: invoice.email,
          subject: `Reminder: Invoice #${invoice._id} is pending`,
          message: `Dear ${invoice.clientName},<br/><br/>This is a friendly reminder that Invoice #${invoice._id} with client name ${invoice.title} for amount ₹${invoice.amount} is still pending. Please make the payment at your earliest convenience.<br/><br/>Thank you!`,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Save last reminder date in localStorage and state
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        // Use invoice._id if available, else fallback to id
        const reminderKey = invoice._id || id;
        const updated = { ...lastReminders, [reminderKey]: dateStr };
        setLastReminders(updated);
        localStorage.setItem('lastReminders', JSON.stringify(updated));
        alert("Reminder email sent successfully!");
      } else {
        alert(`Failed to send reminder: ${data.message}`);
      }
    } catch (error) {
      console.error("Error sending reminder:", error);
      alert("An error occurred while sending the reminder.");
    } finally {
      setSendingReminder(null); // Reset loading state regardless of outcome
    }
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.title.toLowerCase().includes(searchInvoices.toLowerCase())
  );

  const filteredPayments = payments.filter(payment =>
    payment.title.toLowerCase().includes(searchPayments.toLowerCase())
  );

  // Complete rewrite of the handleInputChange function
  const handleInputChange = (e, isEdit = false) => {
    const { name, value } = e.target;

    // For amount field, only update if it's a valid number or empty
    if (name === "amount") {
      // Skip validation if empty or matches number pattern
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        if (isEdit) {
          setEditInvoice(prev => ({
            ...prev,
            [name]: value
          }));
        } else {
          setNewInvoice(prev => ({
            ...prev,
            [name]: value
          }));
        }
      }
    } else {
      // For non-amount fields, update normally
      if (isEdit) {
        setEditInvoice(prev => ({
          ...prev,
          [name]: value
        }));
      } else {
        setNewInvoice(prev => ({
          ...prev,
          [name]: value
        }));
      }
    }
  };

  const handleClientSelect = (e) => {
    const selectedTitle = e.target.value;
    const selectedProposal = proposals.find((p) => p.institution === selectedTitle);
    setNewInvoice(prev => ({
      ...prev,
      title: selectedTitle,
      email: selectedProposal?.collegeEmail || ""
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newId = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`;
    // Convert amount to number right before submission
    const invoiceToAdd = {
      id: newId,
      ...newInvoice,
      amount: parseFloat(newInvoice.amount) || 0
    };

    try {
      const response = await axios.post("https://crm-r5rr.onrender.com/api/invoice/create", invoiceToAdd);
      if (response.status === 201) {
        setInvoices([invoiceToAdd, ...invoices]);
        setNewInvoice({ title: "", email: "", amount: "", issued: "", due: "", status: "Awaiting Payment" });
        setShowModal(false);
        alert('Invoice created successfully!');
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
      alert('Failed to create invoice');
    }
  };

  const handleEdit = (invoice) => {
    setEditInvoice({ ...invoice });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      // Convert amount to number right before submission
      const updatedInvoice = {
        ...editInvoice,
        amount: parseFloat(editInvoice.amount) || 0
      };

      const response = await axios.put(`https://crm-r5rr.onrender.com/api/invoice/update/${editInvoice._id}`, updatedInvoice);
      if (response.status === 200) {
        const updatedList = invoices.map(inv => inv._id === editInvoice._id ? updatedInvoice : inv);
        setInvoices(updatedList);
        setShowEditModal(false);
        alert('Invoice updated successfully!');
      }
    } catch (err) {
      console.error("Failed to update invoice:", err);
      alert('Failed to update invoice');
    }
  };

  const Modal = ({ isEdit = false }) => {
    const invoice = isEdit ? editInvoice : newInvoice;
    const onSubmit = isEdit ? handleUpdate : handleSubmit;
    const closeModal = () => isEdit ? setShowEditModal(false) : setShowModal(false);

    // Create a controlled input for the amount field with validation
    const handleAmountChange = (e) => {
      const value = e.target.value;

      // Allow empty string or valid decimal numbers
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        if (isEdit) {
          setEditInvoice(prev => ({ ...prev, amount: value }));
        } else {
          setNewInvoice(prev => ({ ...prev, amount: value }));
        }
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-background-card p-6 rounded-2xl shadow-card w-11/12 max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{isEdit ? "Edit Invoice" : "Create New Invoice"}</h2>
            <button onClick={closeModal} className="text-text-muted hover:text-text-default">
              <IoClose size={24} />
            </button>
          </div>

          <form onSubmit={onSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Client Name</label>
              {isEdit ? (
                // For edit mode: show a non-editable input field with client name
                <input
                  type="text"
                  name="title"
                  value={invoice.title || ''}
                  className="w-full p-2 border rounded"
                  readOnly
                />
              ) : (
                // For create mode: show the dropdown to select a client
                <select
                  name="title"
                  value={invoice.title || ''}
                  onChange={handleClientSelect}
                  className="w-full p-2 border rounded"
                  required
                >
                  <option value="">Select client</option>
                  {loadingProposals ? (
                    <option>Loading...</option>
                  ) : (
                    proposals.map((proposal, index) => (
                      <option key={index} value={proposal.institution}>
                        {proposal.institution}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Client Email</label>
              <input
                type="text"
                name="email"
                value={invoice.email || ''}
                className="w-full p-2 border rounded"
                placeholder="Auto-filled"
                readOnly
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Amount (₹)</label>
              <input
                type="text"
                name="amount"
                value={invoice.amount || ''}
                onChange={handleAmountChange}
                className="w-full p-2 border rounded"
                placeholder="0.00"
                required
                inputMode="decimal"
                ref={amountInputRef}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                name="status"
                value={invoice.status || 'Awaiting Payment'}
                onChange={(e) => handleInputChange(e, isEdit)}
                className="w-full p-2 border rounded"
                required
              >
                <option value="Awaiting Payment">Awaiting Payment</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Issue Date</label>
                <input
                  type="date"
                  name="issued"
                  value={invoice.issued || ''}
                  onChange={(e) => handleInputChange(e, isEdit)}
                  className="w-full p-2 border rounded"
                  max={today}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Due Date</label>
                <input
                  type="date"
                  name="due"
                  value={invoice.due || ''}
                  onChange={(e) => handleInputChange(e, isEdit)}
                  className="w-full p-2 border rounded"
                  min={today}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-primary hover:bg-primary-dark px-4 py-2 rounded text-white"
              >
                {isEdit ? "Update Invoice" : "Create Invoice"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-background-default min-h-screen text-text-default">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Billing & Settlements</h1>
        <button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary-dark px-4 py-2 rounded flex items-center gap-2">
          <FaPlus /> Create New Invoice
        </button>
      </div>

      {showModal && <Modal />}
      {showEditModal && <Modal isEdit />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payments */}
        <div className="bg-background-card p-6 rounded-2xl shadow-card">
          <h2 className="text-xl font-semibold mb-4">Recent Payments</h2>
          <div className="relative mb-4">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="Search payments..."
              className="w-full p-2 pl-10 border rounded"
              value={searchPayments}
              onChange={(e) => setSearchPayments(e.target.value)}
            />
          </div>
          {filteredPayments.map(payment => (
            <div key={payment.id || payment._id} className="p-4 border-b border-border-dark">
              <div className="flex justify-between">
                <span>{payment.title}</span>
                <span className="font-bold">₹{payment.amount}</span>
              </div>
              <p className="text-text-muted text-sm">Paid on {payment.paidOn || payment.due}</p>
              <p className={`text-sm ${statusColors[payment.status]}`}>{payment.status}</p>
            </div>
          ))}
        </div>

        {/* Invoices */}
        <div className="bg-background-card p-6 rounded-2xl shadow-card">
          <h2 className="text-xl font-semibold mb-4">Invoices</h2>
          <div className="relative mb-4">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="Search invoices..."
              className="w-full p-2 pl-10 border rounded"
              value={searchInvoices}
              onChange={(e) => setSearchInvoices(e.target.value)}
            />
          </div>
          {filteredInvoices.map(invoice => {
            const reminderKey = invoice._id || invoice.id;
            return (
              <div key={reminderKey} className="p-4 border-b border-border-dark">
                <div className="flex justify-between">
                  <span>{invoice.title}</span>
                  <span className="font-bold">₹{invoice.amount}</span>
                </div>
                <p className="text-text-muted text-sm">Due on {invoice.due}</p>
                {invoice.status === 'Awaiting Payment' && lastReminders[reminderKey] && (
                  <p className="text-text-muted text-xs">Last reminder sent: {lastReminders[reminderKey]}</p>
                )}
                <p className={`text-sm ${statusColors[invoice.status]}`}>{invoice.status}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleEdit(invoice)}
                    className="bg-primary text-white px-4 py-2 rounded w-full sm:w-auto flex items-center justify-center gap-2"
                  >
                    <FaEdit /> Edit
                  </button>
                  {invoice.status === "Paid" ? null : (
                    sendingReminder === invoice._id ? (
                      <button
                        disabled
                        className="bg-secondary text-white px-4 py-2 rounded w-full sm:w-auto flex items-center justify-center gap-2"
                      >
                        <span className="animate-pulse">Sending...</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendReminder(invoice._id, invoice)}
                        className="bg-secondary text-white px-4 py-2 rounded w-full sm:w-auto flex items-center justify-center gap-2"
                      >
                        <FaDownload /> Reminder
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}