FROM amazonlinux:2023

RUN yum update -y && echo "1"
RUN yum install -y tar gzip git
RUN yum groupinstall 'Development Tools' -y

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
RUN yum -y install gcc-c++ make
ENV NVM_DIR=/root/.nvm
# npm install github:fromkeith/runlam isn't working on docker for windows
RUN mkdir -p /tmp/ && \
    cd /tmp && \
    git clone https://github.com/fromkeith/runlam.git
RUN source $NVM_DIR/nvm.sh && \
    nvm install 20.12.0 && \
    npm install -g node-gyp node-pre-gyp && \
    cd /tmp/runlam && npm install && \
    cd / && npm install -g /tmp/runlam

RUN echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' > "/root/.bashrc"