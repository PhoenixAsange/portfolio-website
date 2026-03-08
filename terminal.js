// terminal.js — handles the demo terminal input behavior
(function(){
  /**
   * Represents a single terminal command.
   *
   * @param {string} name - Command name (e.g. 'help')
   * @param {string} description - Short description used by the help command
   * @param {Function} handler - Async function (args, ctx) that performs the command work
   *                             and returns a string, array of strings, an object
   *                             with { clear: true } to signal a clear, or void.
   */
  class TerminalCommand {
    constructor(name, description, handler){
      // Store normalized values
      this.name = String(name);
      this.description = String(description || '');
      this.handler = typeof handler === 'function' ? handler : (()=>undefined);
    }

    /**
     * Run the command's handler.
     * Catches errors and converts them into a readable message array.
     *
     * @param {string[]} [args=[]] - Parsed arguments passed to the command
     * @param {object} [ctx={}] - Context object ({input, output, terminal}) provided by the caller
     * @returns {Promise<string|string[]|{clear:true}|void>}
     */
    async run(args = [], ctx = {}){
      try {
        return await this.handler(args, ctx);
      } catch (err) {
        // If a command throws, return an array with an error message so caller can render it
        return [`Error running ${this.name}: ${err && err.message ? err.message : err}`];
      }
    }
  }

  /**
   * Represents a file or directory discovered on disk.
   * This class is a plain data container — the actual filesystem scanning
   * and population of instances will be implemented elsewhere.
   *
   * Intended usage: create an instance and later call a scanner to populate
   * properties like size, mtime, mimeType, and optionally `content`.
   */
  class FileEntry {
    /**
     * @param {object} [opts]
     * @param {string} [opts.path] - Absolute path to the file or directory
     * @param {string} [opts.name] - Base name (file or directory name)
     * @param {boolean} [opts.isDirectory=false]
     * @param {number} [opts.size=0] - Size in bytes (for files)
     * @param {Date|string|null} [opts.mtime=null] - Last modified time
     * @param {string|null} [opts.mimeType=null] - Detected MIME type
     * @param {string|null} [opts.hash=null] - Optional content hash (sha1/sha256)
     * @param {object|null} [opts.mode=null] - File mode/permissions object (platform dependent)
     */
    constructor(opts = {}){
      this.path = opts.path || null;
      this.name = opts.name || (this.path ? String(this.path).split('/').pop() : null);
      this.isDirectory = Boolean(opts.isDirectory);
      this.size = typeof opts.size === 'number' ? opts.size : 0;
      this.mtime = opts.mtime ? new Date(opts.mtime) : null;
      this.mimeType = opts.mimeType || null;
      this.hash = opts.hash || null;
      this.mode = opts.mode || null;

      // content is intentionally left null until a scanner reads the file
      this.content = null;

      // for directories, children will be an array of FileEntry instances (populated by a scanner)
      this.children = Array.isArray(opts.children) ? opts.children.slice() : null;
    }

    /**
     * Lightweight JSON representation suitable for sending to the UI.
     */
    toJSON(){
      return {
        path: this.path,
        name: this.name,
        isDirectory: this.isDirectory,
        size: this.size,
        mtime: this.mtime ? this.mtime.toISOString() : null,
        mimeType: this.mimeType,
        hash: this.hash,
        mode: this.mode,
        // do not include raw content by default
        hasContent: this.content != null,
        children: this.children ? this.children.map(c => c.toJSON()) : null
      };
    }

    /**
     * Set the in-memory content for this entry. Scanner will call this when
     * it reads file bytes/text. Caller may pass a string or Uint8Array.
     * @param {string|Uint8Array} data
     */
    setContent(data){
      this.content = data;
    }

    /**
     * Placeholder for a platform/stat-based initializer. The actual implementation
     * should map fs.Stats (Node) or other metadata into this instance.
     * Not implemented here by design.
     */
    static fromStat(/* statObj */){
      throw new Error('FileEntry.fromStat is not implemented; implement scanning separately');
    }
  }

  // Simple registry for commands
  // Registry that stores commands by name.
  const commands = new Map();

  /**
   * Register a TerminalCommand instance in the global registry.
   * Throws if the argument is not a TerminalCommand.
   *
   * @param {TerminalCommand} cmd
   */
  function registerCommand(cmd){
    if(!(cmd instanceof TerminalCommand)) throw new TypeError('registerCommand expects a TerminalCommand');
    commands.set(cmd.name, cmd);
  }

  /**
   * Retrieve a registered command by name.
   * @param {string} name
   * @returns {TerminalCommand|undefined}
   */
  function getCommand(name){ return commands.get(name); }

  /**
   * Append one or more textual lines to the terminal output container.
   * Each item is wrapped in the existing `.line` markup and receives the prompt prefix.
   *
   * @param {string|string[]} lines - A string or array of strings to append
   * @param {HTMLElement} output - The DOM element that contains output lines
   */
  function appendLines(lines, output){
    if(!output) return;
    (Array.isArray(lines) ? lines : [lines]).forEach(text => {
      const line = document.createElement('div');
      line.className = 'line';
      const prompt = document.createElement('span');
      prompt.className = 'prompt';
      prompt.textContent = 'user@phoenix:';
      const out = document.createElement('span');
      out.textContent = ' $ ' + String(text);
      line.appendChild(prompt);
      line.appendChild(document.createTextNode(' '));
      line.appendChild(out);
      output.appendChild(line);
    });
  }

  // Register a few demo commands
  registerCommand(new TerminalCommand('help', 'List available commands', (args, ctx)=>{
    const lines = ['Available commands:'];
    for(const cmd of commands.values()){
      lines.push(`${cmd.name} — ${cmd.description}`);
    }
    return lines;
  }));

  registerCommand(new TerminalCommand('echo', 'Echo the provided arguments', (args)=>{
    return [args.join(' ')];
  }));

  registerCommand(new TerminalCommand('clear', 'Clear the terminal output', (args, ctx)=>{
    // signal to caller to clear the output
    return { clear: true };
  }));

  /**
   * Initialize the terminal UI bindings.
   * Finds the input and output elements, wires the Enter key to parse and execute
   * registered commands, and handles rendering of results (including clearing output).
   */
  function init(){
    const input = document.getElementById('terminal-input');
    const terminal = document.querySelector('.terminal');
    const output = document.getElementById('terminal-output');
    if(!input || !terminal) return;

    // Execute command when the user presses Enter
    input.addEventListener('keydown', async function(e){
      if(e.key !== 'Enter') return;
      const val = input.value.trim();
      if(val === '') return;

      // parse command and args
      const parts = val.split(/\s+/);
      const name = parts[0];
      const args = parts.slice(1);

      const cmd = getCommand(name);
      if(cmd){
        const res = await cmd.run(args, { input, output, terminal });
        if(res && typeof res === 'object' && res.clear){
          if(output) output.innerHTML = '';
        } else if(Array.isArray(res)){
          appendLines(res, output);
        } else if(typeof res === 'string'){
          appendLines([res], output);
        }
      } else {
        // fallback: just echo the entered line
        appendLines([val], output);
      }

      input.value = '';
      input.focus();
      window.scrollTo(0, document.body.scrollHeight);
    });

    // auto-focus the input so the user can start typing immediately
    input.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose classes/registry on window for debugging / extensions
  window.TerminalCommand = TerminalCommand;
  window._terminalCommands = commands;

})();
 