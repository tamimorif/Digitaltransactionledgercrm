# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Login to System" [level=4] [ref=e5]
      - paragraph [ref=e6]: Enter your email and password
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]:
          - generic [ref=e11]: Email or Username
          - textbox "Email or Username" [active] [ref=e12]:
            - /placeholder: Enter your email or username
          - paragraph [ref=e13]: Email or Username is required
        - generic [ref=e14]:
          - generic [ref=e15]:
            - generic [ref=e16]: Password
            - link "Forgot Password?" [ref=e17]:
              - /url: /forgot-password
          - textbox "Password" [ref=e18]:
            - /placeholder: ••••••••
            - text: wrongpassword
        - button "Login" [ref=e19]
      - paragraph [ref=e21]:
        - text: Don't have an account?
        - link "Sign up" [ref=e22]:
          - /url: /register
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e28] [cursor=pointer]:
    - img [ref=e29]
  - alert [ref=e34]
```