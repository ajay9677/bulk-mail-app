import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API = "http://localhost:5000/api/emails";

function App() {
  const [page, setPage] = useState("compose");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const recipientList = recipients
    .split(/[,\s;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const uniqueRecipients = [...new Set(recipientList)];

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/history`);
      setHistory(response.data);
    } catch (error) {
      console.error("History error:", error.message);
      setMessage("Unable to load email history.");
      setMessageType("error");
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const sendEmail = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!subject.trim() || !body.trim() || !recipients.trim()) {
      setMessage("Please fill in all fields.");
      setMessageType("error");
      return;
    }

    if (recipientList.some((email) => !validEmail.test(email))) {
      setMessage("Please enter valid email addresses.");
      setMessageType("error");
      return;
    }

    if (recipientList.length > 50) {
      setMessage("Maximum 50 recipient entries per send.");
      setMessageType("error");
      return;
    }

    if (uniqueRecipients.length !== recipientList.length) {
      setMessage("Duplicate email addresses found. Remove duplicates.");
      setMessageType("error");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API}/send`, {
        subject,
        body,
        recipients: uniqueRecipients
      });

      const result = response.data;

      setMessage(
        `${result.message} Sent: ${result.sentCount}. Failed: ${result.failedCount}.`
      );
      setMessageType(
        result.status === "sent"
          ? "success"
          : result.status === "partial"
            ? "warning"
            : "error"
      );

      setSubject("");
      setBody("");
      setRecipients("");

      await fetchHistory();
      setPage("history");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Unable to send emails. Check your server and connection."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const openHistory = async () => {
    setPage("history");
    await fetchHistory();
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">M</div>
            <div>
            <h2>Bulk Mail</h2>
            <p>Bulk Mail Manager</p>
          </div>
        </div>

        <p className="menu-label">WORKSPACE</p>

        <button
          className={`nav-item ${page === "compose" ? "active" : ""}`}
          onClick={() => {
            setPage("compose");
            setMessage("");
          }}
        >
          <span>✉</span> Compose Email
        </button>

        <button
          className={`nav-item ${page === "history" ? "active" : ""}`}
          onClick={openHistory}
        >
          <span>◷</span> Email History
        </button>

        <div className="sidebar-footer">
          <div className="avatar">A</div>
          <div>
            <strong>Administrator</strong>
            <p>Mail workspace</p>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>
              {page === "compose" ? "Compose Email" : "Email History"}
            </h1>
          </div>
          <div className="connection">
            <span className="connection-dot"></span>
            Mail dashboard
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon purple">✉</span>
            <p>Total campaigns</p>
            <h2>{history.length}</h2>
            <small>Latest 100 records</small>
          </div>

          <div className="stat-card">
            <span className="stat-icon green">✓</span>
            <p>Successful campaigns</p>
            <h2>
              {history.filter((item) => item.status === "sent").length}
            </h2>
            <small>All recipients accepted</small>
          </div>

          <div className="stat-card">
            <span className="stat-icon orange">↗</span>
            <p>Emails accepted</p>
            <h2>
              {history.reduce(
                (total, item) => total + (item.sentCount || 0),
                0
              )}
            </h2>
            <small>Sending requests accepted</small>
          </div>
        </section>

        {message && (
          <div className={`notice ${messageType}`} role="status">
            {message}
            <button
              type="button"
              className="notice-close"
              onClick={() => setMessage("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {page === "compose" ? (
          <section className="panel compose-panel">
            <div className="panel-heading">
              <div>
                <h2>New campaign</h2>
                <p>Prepare your message and choose its recipients.</p>
              </div>
              <span className="draft-badge">EMAIL COMPOSER</span>
            </div>

            <form onSubmit={sendEmail}>
              <div className="form-group">
                <label htmlFor="recipients">Recipient emails</label>
                <textarea
                  id="recipients"
                  rows="3"
                  placeholder={"student1@example.com"}
                  value={recipients}
                  onChange={(event) => setRecipients(event.target.value)}
                />
                <div className="field-footer">
                  <span>Separate addresses with commas or new lines.</span>
                  <strong>{uniqueRecipients.length} recipients</strong>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="subject">Email subject</label>
                <input
                  id="subject"
                  type="text"
                  placeholder="Enter your email subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="form-group">
                <label htmlFor="body">Email message</label>
                <textarea
                  id="body"
                  rows="8"
                  placeholder="Write your email message here..."
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={20000}
                />
                <div className="field-footer">
                  <span>Plain-text email</span>
                  <span>{body.length}/20000</span>
                </div>
              </div>

              <div className="send-summary">
                <span className="summary-icon">ⓘ</span>
                <p>
                  Each recipient receives a separate email. Maximum 50
                  recipient entries per send.
                </p>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setSubject("");
                    setBody("");
                    setRecipients("");
                    setMessage("");
                  }}
                  disabled={loading}
                >
                  Clear form
                </button>

                <button
                  type="submit"
                  className="send-button"
                  disabled={loading}
                >
                  {loading ? "Sending emails..." : "➤  Send emails"}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="panel history-panel">
            <div className="panel-heading">
              <div>
                <h2>Recent email activity</h2>
                <p>View your previous sending attempts and their status.</p>
              </div>

              <button
                className="secondary-button"
                onClick={fetchHistory}
              >
                ↻ Refresh
              </button>
            </div>

            {history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✉</div>
                <h3>No email history yet</h3>
                <p>Your sent email records will appear here.</p>
                <button
                  className="send-button"
                  onClick={() => setPage("compose")}
                >
                  Compose your first email
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Recipients</th>
                      <th>Accepted</th>
                      <th>Failed</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item._id}>
                        <td className="subject-cell">{item.subject}</td>
                        <td>{item.recipients.length}</td>
                        <td>{item.sentCount}</td>
                        <td>{item.failedCount}</td>
                        <td>
                          <span className={`status ${item.status}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <footer className="page-footer">
          <span>Bulk Mail</span>
          <span>&copy;2026 Bulk Mail App. All Rights Reserved.</span>
        </footer>
      </main>
    </div>
  );
}

export default App;