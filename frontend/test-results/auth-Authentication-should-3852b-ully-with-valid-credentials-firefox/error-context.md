# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Login to System" [level=4] [ref=e5]
      - paragraph [ref=e6]: Enter your email and password
    - generic [ref=e8]:
      - alert [ref=e9]:
        - img [ref=e10]
        - generic [ref=e14]: Invalid email or password
      - generic [ref=e15]:
        - generic [ref=e16]:
          - generic [ref=e17]: Email or Username
          - textbox "Email or Username" [ref=e18]:
            - /placeholder: Enter your email or username
            - text: test@example.com
        - generic [ref=e19]:
          - generic [ref=e20]:
            - generic [ref=e21]: Password
            - link "Forgot Password?" [ref=e22] [cursor=pointer]:
              - /url: /forgot-password
          - textbox "Password" [ref=e23]:
            - /placeholder: ••••••••
            - text: testpassword123
        - button "Login" [ref=e24]
      - paragraph [ref=e26]:
        - text: Don't have an account?
        - link "Sign up" [ref=e27] [cursor=pointer]:
          - /url: /register
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e33] [cursor=pointer]:
    - img [ref=e34]
  - alert [ref=e38]
```